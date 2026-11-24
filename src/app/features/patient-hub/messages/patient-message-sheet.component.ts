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
import { InputChatAudioError, InputChatComponent } from '../../../shared/components/input-chat/input-chat.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import {
  blockedMessage,
  EMPTY_CONTENT_HINT,
  entryForAll,
  entryForGroup,
  entryForPerson,
  GROUP_KEYS,
  GROUPS,
  isBlocked,
  LinkedProfessional,
  OFFLINE_HINT,
  parseMentions,
  PatientRecord,
  RecipientEntry,
  resolveRecipients,
  SEND_FAILED_HINT,
} from './patient-message.models';
import { MessageAiAssistant, PatientMessageSource, PatientTeamSource } from './patient-message-source';

export const AI_UNAVAILABLE_HINT =
  'Sugestão de destinatário indisponível. Mencione quem deve receber (ex.: @enfermagem) ou registre como observação.';
export const AI_FAILED_AUDIO_HINT = 'Não foi possível transcrever o áudio. Digite o conteúdo manualmente.';
export const AI_EMPTY_AUDIO_HINT = 'Nenhum texto foi reconhecido no áudio. Digite o conteúdo manualmente.';
export const MIC_DENIED_HINT = 'Sem acesso ao microfone. Digite o conteúdo ou permita o microfone e tente de novo.';
export const MIC_FAILED_HINT = 'Não foi possível gravar o áudio. Digite o conteúdo ou tente de novo.';
export const TRANSCRIBED_NOTE = 'Texto transcrito do áudio. Revise antes de continuar.';
export const AI_SUGGESTED_NOTE = 'Sugerido pela IA. Confirme, altere ou remova antes de enviar.';
export const TEAM_FAILED_HINT =
  'Não foi possível carregar a equipe do paciente. Registre como observação ou tente de novo.';

type Step = 'compose' | 'review';

/**
 * Registro do Hub via assistente (FT-005-1, US-005-1-01): o profissional descreve a situação (texto ou áudio
 * transcrito), o assistente mostra os destinatários mencionados ou sugeridos e só a confirmação explícita
 * grava. Sem destinatário vira observação (não notifica). Desenho do Figma inexistente: reaproveita o padrão
 * de sheet do Registro diário e os componentes v2.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconLogoComponent, ButtonComponent, IconButtonComponent, InputChatComponent],
  selector: 'app-patient-message-sheet',
  styleUrl: './patient-message-sheet.component.scss',
  templateUrl: './patient-message-sheet.component.html',
})
export class PatientMessageSheetComponent {
  readonly open = input(false);
  readonly patientId = input.required<string>();
  readonly closed = output();
  /** Registro gravado: quem hospeda a tela atualiza a lista de cards. */
  readonly sent = output<PatientRecord>();

  protected readonly online = inject(ConnectivityService).online;
  protected readonly step = signal<Step>('compose');
  protected readonly content = signal('');
  protected readonly entries = signal<readonly RecipientEntry[]>([]);
  protected readonly team = signal<readonly LinkedProfessional[]>([]);
  protected readonly notice = signal<string | null>(null);
  protected readonly hint = signal<string | null>(null);
  protected readonly working = signal(false);
  protected readonly saving = signal(false);
  protected readonly transcribed = signal(false);
  protected readonly offlineHint = OFFLINE_HINT;
  protected readonly aiSuggestedNote = AI_SUGGESTED_NOTE;
  protected readonly transcribedNote = TRANSCRIBED_NOTE;
  protected readonly groupOptions = GROUP_KEYS.map(key => ({ key, label: GROUPS[key].label }));
  protected readonly hasBlocked = computed(() => this.entries().some(isBlocked));
  protected readonly hasSuggested = computed(() => this.entries().some(e => e.origin === 'ai'));
  protected readonly recipientCount = computed(() => resolveRecipients(this.entries()).length);
  protected readonly isObservation = computed(() => this.entries().length === 0);
  protected readonly canConfirm = computed(() => this.online() && !this.saving() && !this.hasBlocked());
  protected readonly pickable = computed(() => {
    const taken = new Set(this.entries().map(e => e.key));

    return this.team().filter(p => !taken.has(`person:${p.id}`));
  });

  private readonly source = inject(PatientMessageSource);
  private readonly teamSource = inject(PatientTeamSource);
  private readonly assistant = inject(MessageAiAssistant);
  private readonly professional = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  private viaAudio = false;
  /** Descarta respostas de uma abertura anterior (fechar e reabrir rápido, ou troca de paciente). */
  private token = 0;
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    effect(() => {
      const element = this.dialogRef()?.nativeElement;
      const isOpen = this.open();

      if (!element) {
        return;
      }
      if (isOpen && !element.open) {
        element.showModal();
      } else if (!isOpen && element.open) {
        element.close();
      }
    });
    effect(() => {
      if (this.open()) {
        const id = this.patientId();

        untracked(() => void this.start(id));
      } else {
        untracked(() => this.token++);
      }
    });
  }

  protected blocked(entry: RecipientEntry): string {
    return blockedMessage(entry);
  }

  protected members(entry: RecipientEntry): string {
    return entry.members.map(m => m.name).join(', ');
  }

  protected onContent(event: Event): void {
    this.content.set((event.target as HTMLTextAreaElement).value);
    this.hint.set(null);
    this.transcribed.set(false);
  }

  /** Texto enviado pelo campo do assistente: acrescenta ao conteúdo, ainda sem enviar. */
  protected onChatText(text: string): void {
    const current = this.content().trim();

    this.content.set(current === '' ? text : `${current}\n${text}`);
    this.hint.set(null);
  }

  /** Áudio gravado: a IA transcreve para o campo de conteúdo; nunca grava. Falha libera a digitação manual. */
  protected async onAudio(audio: Blob): Promise<void> {
    if (!this.online() || this.working()) {
      return;
    }
    const token = this.token;

    this.notice.set(null);
    this.working.set(true);
    try {
      const text = (await this.assistant.transcribe(audio)).trim();

      if (token !== this.token) {
        return;
      }
      if (text === '') {
        this.notice.set(AI_EMPTY_AUDIO_HINT);

        return;
      }
      const current = this.content().trim();

      this.content.set(current === '' ? text : `${current}\n${text}`);
      this.viaAudio = true;
      this.transcribed.set(true);
    } catch {
      if (token === this.token) {
        this.notice.set(AI_FAILED_AUDIO_HINT);
      }
    } finally {
      if (token === this.token) {
        this.working.set(false);
      }
    }
  }

  protected onAudioError(reason: InputChatAudioError): void {
    this.notice.set(reason === 'permission-denied' ? MIC_DENIED_HINT : MIC_FAILED_HINT);
  }

  /** Interpreta as menções; sem menção, pede sugestão à IA. Nada é enviado aqui. */
  protected async review(): Promise<void> {
    if (this.content().trim() === '') {
      this.hint.set(EMPTY_CONTENT_HINT);

      return;
    }
    const token = this.token;
    const mentioned = parseMentions(this.content(), this.team());

    this.notice.set(null);
    this.hint.set(null);
    this.entries.set(mentioned);
    if (mentioned.length === 0 && this.online()) {
      this.working.set(true);
      try {
        const groups = await this.assistant.suggestGroups(this.content());

        if (token !== this.token) {
          return;
        }
        this.entries.set(groups.map(group => entryForGroup(group, this.team(), 'ai')));
      } catch {
        if (token === this.token) {
          this.notice.set(AI_UNAVAILABLE_HINT);
        }
      } finally {
        if (token === this.token) {
          this.working.set(false);
        }
      }
    }
    this.step.set('review');
  }

  protected backToCompose(): void {
    this.step.set('compose');
    this.hint.set(null);
  }

  protected removeEntry(key: string): void {
    this.entries.update(list => list.filter(e => e.key !== key));
  }

  /** Recusa todos os destinatários: o registro segue como observação, sem notificar ninguém. */
  protected asObservation(): void {
    this.entries.set([]);
  }

  protected addGroup(value: string): void {
    if (value === 'all') {
      this.addEntry(entryForAll(this.team(), 'mention'));
    } else if (value.startsWith('group:')) {
      const group = GROUP_KEYS.find(key => key === value.slice(6));

      if (group) {
        this.addEntry(entryForGroup(group, this.team(), 'mention'));
      }
    } else if (value.startsWith('person:')) {
      const person = this.team().find(p => `person:${p.id}` === value);

      if (person) {
        this.addEntry(entryForPerson(person, 'mention'));
      }
    }
  }

  protected close(): void {
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

  /** Só a confirmação explícita grava; offline ou destinatário inválido não grava. */
  protected async confirm(): Promise<void> {
    if (!this.online()) {
      this.hint.set(OFFLINE_HINT);

      return;
    }
    if (!this.canConfirm()) {
      return;
    }
    const token = this.token;

    this.saving.set(true);
    this.hint.set(null);
    try {
      const record = await this.source.send({
        at: this.now().toISOString(),
        author: this.professional.read().name,
        content: this.content().trim(),
        patientId: this.patientId(),
        recipients: resolveRecipients(this.entries()),
        viaAudio: this.viaAudio,
      });

      this.sent.emit(record);
      if (token === this.token) {
        this.reset();
        this.closed.emit();
      }
    } catch {
      if (token === this.token) {
        this.hint.set(SEND_FAILED_HINT);
      }
    } finally {
      this.saving.set(false);
    }
  }

  private addEntry(entry: RecipientEntry): void {
    this.entries.update(list => (list.some(e => e.key === entry.key) ? list : [...list, entry]));
  }

  private reset(): void {
    this.step.set('compose');
    this.content.set('');
    this.entries.set([]);
    this.notice.set(null);
    this.hint.set(null);
    this.transcribed.set(false);
    this.working.set(false);
    this.viaAudio = false;
  }

  private async start(patientId: string): Promise<void> {
    const token = ++this.token;

    this.reset();
    this.team.set([]);
    try {
      const team = await this.teamSource.listLinked(patientId);

      if (token === this.token) {
        this.team.set(team);
      }
    } catch {
      if (token === this.token) {
        // Sem equipe não há como resolver menções, mas a observação segue possível (Princípio VI).
        this.notice.set(TEAM_FAILED_HINT);
      }
    }
  }
}
