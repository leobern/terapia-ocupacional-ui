import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { IconButtonComponent } from '../../../shared/components/icon-button/icon-button.component';
import { IconLogoComponent } from '../../../shared/components/icon-logo/icon-logo.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW } from '../../home/professional-profile';
import { CommunicationSuggestion, ObservationFollowUpPort, PendingSuggestion } from './observation-follow-up.port';
import { LinkedProfessional, PatientRecord, RecipientRef, RecipientSpec } from './patient-message.models';
import { PatientTeamSource } from './patient-message-source';

export const FOLLOW_UP_OFFLINE_HINT = 'Sem conexão: criar a pendência ou enviar a mensagem fica indisponível.';
export const FOLLOW_UP_FAILED_HINT = 'Não foi possível concluir. Nada foi criado ou enviado; tente novamente.';
export const FOLLOW_UP_DUPLICATE_HINT = 'Esta observação já tem uma pendência de reavaliação.';

type Outcome = 'pending' | 'declined' | 'done';

const pad = (n: number): string => String(n).padStart(2, '0');

/** `yyyy-MM-dd` no fuso local. */
export const toDateInput = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const sameIds = (selected: ReadonlySet<number>, refs: readonly RecipientRef[]): boolean =>
  selected.size === refs.length && refs.every(r => selected.has(r.id));

/**
 * Sugestões após registrar uma observação sem destinatário (US-005-1-04): pendência de reavaliação e/ou
 * comunicação com rascunho editável. As duas são independentes e nada é criado ou enviado sem confirmação
 * explícita; recusar não chama a API. Se o backend/IA estiver indisponível ou nada fizer sentido, o diálogo
 * nem abre (a observação segue registrada). Sem frame no Figma: mesmo padrão de sheet do cadastro de mensagem.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconLogoComponent, ButtonComponent, IconButtonComponent],
  selector: 'app-observation-follow-up',
  styleUrl: './patient-message-sheet.component.scss',
  templateUrl: './observation-follow-up.component.html',
})
export class ObservationFollowUpComponent {
  /** Observação recém-registrada; `null` = fechado. */
  readonly record = input<PatientRecord | null>(null);
  readonly closed = output();
  /** Pendência criada ou mensagem enviada: quem hospeda recarrega a lista de threads. */
  readonly changed = output();

  protected readonly online = inject(ConnectivityService).online;
  protected readonly offlineHint = FOLLOW_UP_OFFLINE_HINT;
  protected readonly pendingSuggestion = signal<PendingSuggestion | null>(null);
  protected readonly communicationSuggestion = signal<CommunicationSuggestion | null>(null);
  protected readonly team = signal<readonly LinkedProfessional[]>([]);
  protected readonly pendingPeople = signal<ReadonlySet<number>>(new Set());
  protected readonly communicationPeople = signal<ReadonlySet<number>>(new Set());
  protected readonly dueDate = signal('');
  protected readonly draft = signal('');
  protected readonly pendingOutcome = signal<Outcome>('pending');
  protected readonly communicationOutcome = signal<Outcome>('pending');
  protected readonly saving = signal(false);
  protected readonly hint = signal<string | null>(null);
  protected readonly isOpen = computed(() => this.record() !== null && this.visible());
  protected readonly today = computed(() => toDateInput(this.now()));
  protected readonly pendingOptions = computed(() => this.options(this.pendingSuggestion()?.resolvedRecipients ?? []));
  protected readonly communicationOptions = computed(() =>
    this.options(this.communicationSuggestion()?.resolvedRecipients ?? []),
  );
  protected readonly pastDate = computed(() => this.dueDate() === '' || this.dueDate() < this.today());
  protected readonly canCreate = computed(
    () => this.online() && !this.saving() && !this.pastDate() && this.pendingPeople().size > 0,
  );
  protected readonly canSend = computed(
    () => this.online() && !this.saving() && this.draft().trim() !== '' && this.communicationPeople().size > 0,
  );

  private readonly visible = signal(false);
  private readonly port = inject(ObservationFollowUpPort);
  private readonly teamSource = inject(PatientTeamSource);
  private readonly now = inject(NOW);
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    effect(() => {
      const element = this.dialogRef()?.nativeElement;
      const open = this.isOpen();

      if (!element) {
        return;
      }
      if (open && !element.open) {
        element.showModal();
      } else if (!open && element.open) {
        element.close();
      }
    });
    effect(() => {
      const record = this.record();

      untracked(() => {
        this.visible.set(false);
        if (record !== null) {
          void this.load(record);
        }
      });
    });
  }

  protected isPicked(group: 'pending' | 'communication', id: number): boolean {
    return (group === 'pending' ? this.pendingPeople() : this.communicationPeople()).has(id);
  }

  protected toggle(group: 'pending' | 'communication', id: number): void {
    const target = group === 'pending' ? this.pendingPeople : this.communicationPeople;
    const next = new Set(target());

    if (!next.delete(id)) {
      next.add(id);
    }
    target.set(next);
  }

  protected onDue(event: Event): void {
    this.dueDate.set((event.target as HTMLInputElement).value);
    this.hint.set(null);
  }

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  /** Recusa: a observação segue registrada, sem pendência nem mensagem, e nenhuma chamada é feita. */
  protected decline(which: 'pending' | 'communication' | 'both'): void {
    if (which !== 'communication') {
      this.pendingOutcome.set('declined');
    }
    if (which !== 'pending') {
      this.communicationOutcome.set('declined');
    }
    this.finishIfResolved();
  }

  protected async createPending(): Promise<void> {
    const record = this.record();
    const suggestion = this.pendingSuggestion();

    if (record === null || suggestion === null || !this.canCreate()) {
      return;
    }
    // Destinatário padrão intacto: omite `destinatarios` e o backend aplica o grupo do perfil do autor.
    const recipients = sameIds(this.pendingPeople(), suggestion.resolvedRecipients)
      ? null
      : this.specs(this.pendingPeople());

    await this.run(async () => {
      await this.port.createPending(record.patientId, record.id, this.dueIso(suggestion), recipients);
      this.pendingOutcome.set('done');
    }, true);
  }

  /** Só envia com a confirmação explícita, usando o texto como está no campo (editado ou não). */
  protected async sendMessage(): Promise<void> {
    const record = this.record();
    const suggestion = this.communicationSuggestion();

    if (record === null || suggestion === null || !this.canSend()) {
      return;
    }
    const recipients = sameIds(this.communicationPeople(), suggestion.resolvedRecipients)
      ? suggestion.suggestedRecipients
      : this.specs(this.communicationPeople());

    await this.run(async () => {
      await this.port.sendCommunication(record.patientId, record.id, this.draft().trim(), recipients);
      this.communicationOutcome.set('done');
    }, false);
  }

  protected close(): void {
    this.visible.set(false);
    this.closed.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    // Clique no ::backdrop chega com o próprio <dialog> como alvo.
    if (event.target instanceof HTMLDialogElement) {
      this.close();
    }
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  private options(resolved: readonly RecipientRef[]): readonly RecipientRef[] {
    const byId = new Map<number, RecipientRef>(resolved.map(r => [r.id, r]));

    for (const member of this.team()) {
      if (!byId.has(member.id)) {
        byId.set(member.id, { id: member.id, name: member.name, specialty: member.specialty });
      }
    }

    return [...byId.values()];
  }

  private specs(people: ReadonlySet<number>): readonly RecipientSpec[] {
    return [...people].map(id => ({ professionalId: id, type: 'PESSOA' }));
  }

  /** Prazo confirmado: mantém o sugerido se a data não mudou; senão, fim do dia escolhido (fuso local). */
  private dueIso(suggestion: PendingSuggestion): string {
    return toDateInput(new Date(suggestion.suggestedDueAt)) === this.dueDate()
      ? suggestion.suggestedDueAt
      : new Date(`${this.dueDate()}T23:59:00`).toISOString();
  }

  private async run(action: () => Promise<void>, pending: boolean): Promise<void> {
    this.saving.set(true);
    this.hint.set(null);
    try {
      await action();
      this.changed.emit();
      this.finishIfResolved();
    } catch (error) {
      this.hint.set(
        pending && error instanceof HttpErrorResponse && error.status === 409
          ? FOLLOW_UP_DUPLICATE_HINT
          : FOLLOW_UP_FAILED_HINT,
      );
    } finally {
      this.saving.set(false);
    }
  }

  private finishIfResolved(): void {
    const pendingDone = this.pendingSuggestion() === null || this.pendingOutcome() !== 'pending';
    const communicationDone = this.communicationSuggestion() === null || this.communicationOutcome() !== 'pending';

    if (pendingDone && communicationDone) {
      this.close();
    }
  }

  private async load(record: PatientRecord): Promise<void> {
    this.pendingOutcome.set('pending');
    this.communicationOutcome.set('pending');
    this.hint.set(null);
    try {
      const [suggestions, team] = await Promise.all([
        this.port.suggestions(record.patientId, record.id),
        this.teamSource.listLinked(record.patientId).catch((): readonly LinkedProfessional[] => []),
      ]);

      if (this.record() !== record) {
        return;
      }
      this.team.set(team);
      this.pendingSuggestion.set(suggestions.pendencia);
      this.communicationSuggestion.set(suggestions.comunicacao);
      this.pendingPeople.set(new Set((suggestions.pendencia?.resolvedRecipients ?? []).map(r => r.id)));
      this.communicationPeople.set(new Set((suggestions.comunicacao?.resolvedRecipients ?? []).map(r => r.id)));
      this.dueDate.set(suggestions.pendencia ? toDateInput(new Date(suggestions.pendencia.suggestedDueAt)) : '');
      this.draft.set(suggestions.comunicacao?.draft ?? '');
      this.visible.set(suggestions.pendencia !== null || suggestions.comunicacao !== null);
    } catch {
      // Backend/IA indisponível: nenhuma sugestão; a observação segue registrada.
      this.visible.set(false);
    }
    if (!this.visible()) {
      this.closed.emit();
    }
  }
}
