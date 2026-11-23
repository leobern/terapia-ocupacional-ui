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
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import {
  CommunicationSuggestion,
  formatIsoDate,
  groupLabel,
  Observation,
  OFFLINE_OBSERVATION_HINT,
  Recipients,
  recipientsLabel,
  ReevaluationSuggestion,
  TeamMember,
  toIsoDate,
  validateRecipients,
} from './observation.models';
import {
  DirectedMessageWriter,
  ObservationSuggester,
  PatientTeamSource,
  ReevaluationWriter,
} from './observation-source';
import { RecipientsEditorComponent } from './recipients-editor.component';

type Outcome = 'pending' | 'declined' | 'done';
type Declining = 'both' | 'communication' | 'reevaluation' | null;

/**
 * Sugestões após registrar uma observação sem destinatário (US-005-1-04): pendência de reavaliação e/ou
 * comunicação com rascunho editável. As duas são independentes e nada é criado ou enviado sem confirmação
 * explícita. Se a IA estiver indisponível ou nada fizer sentido, o diálogo nem abre.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent, RecipientsEditorComponent],
  selector: 'app-observation-follow-up',
  styleUrl: './observation-follow-up.component.scss',
  templateUrl: './observation-follow-up.component.html',
})
export class ObservationFollowUpComponent {
  /** Observação recém-registrada; `null` = fechado. */
  readonly observation = input<Observation | null>(null);
  readonly closed = output();
  /** Pendência criada ou mensagem enviada: o Hub recarrega a lista. */
  readonly changed = output();

  protected readonly online = inject(ConnectivityService).online;
  protected readonly offlineHint = OFFLINE_OBSERVATION_HINT;
  protected readonly team = signal<readonly TeamMember[]>([]);
  protected readonly reevaluation = signal<ReevaluationSuggestion | null>(null);
  protected readonly communication = signal<CommunicationSuggestion | null>(null);
  protected readonly reevaluationOutcome = signal<Outcome>('pending');
  protected readonly communicationOutcome = signal<Outcome>('pending');
  protected readonly reevaluationRecipients = signal<Recipients>({ group: null, people: [] });
  protected readonly communicationRecipients = signal<Recipients>({ group: null, people: [] });
  protected readonly draft = signal('');
  protected readonly declining = signal<Declining>(null);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  protected readonly isOpen = computed(() => this.observation() !== null && this.visible());
  protected readonly reevaluationError = computed(() => validateRecipients(this.reevaluationRecipients(), this.team()));
  protected readonly communicationError = computed(() =>
    validateRecipients(this.communicationRecipients(), this.team()),
  );
  protected readonly dueLabel = computed(() => formatIsoDate(this.reevaluation()?.dueDate ?? ''));
  protected readonly reevaluationSummary = computed(() => recipientsLabel(this.reevaluationRecipients()));
  protected readonly canSendMessage = computed(
    () => this.communicationError() === null && this.draft().trim() !== '' && this.online() && !this.saving(),
  );
  protected readonly canCreate = computed(() => this.reevaluationError() === null && this.online() && !this.saving());
  protected readonly allResolved = computed(
    () =>
      (this.reevaluation() === null || this.reevaluationOutcome() !== 'pending') &&
      (this.communication() === null || this.communicationOutcome() !== 'pending'),
  );
  protected readonly groupLabel = groupLabel;

  private readonly visible = signal(false);
  private readonly suggester = inject(ObservationSuggester);
  private readonly teamSource = inject(PatientTeamSource);
  private readonly reevaluations = inject(ReevaluationWriter);
  private readonly messages = inject(DirectedMessageWriter);
  private readonly professional = inject(ProfessionalProfileReader);
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
      const observation = this.observation();

      untracked(() => {
        this.visible.set(false);
        if (observation !== null) {
          void this.load(observation);
        }
      });
    });
  }

  protected setReevaluationRecipients(value: Recipients): void {
    this.reevaluationRecipients.set(value);
  }

  protected setCommunicationRecipients(value: Recipients): void {
    this.communicationRecipients.set(value);
  }

  protected setDraft(value: string): void {
    this.draft.set(value);
  }

  protected askDecline(which: Declining): void {
    this.declining.set(which);
  }

  protected cancelDecline(): void {
    this.declining.set(null);
  }

  /** Recusa confirmada: a observação segue registrada, sem pendência nem mensagem. */
  protected confirmDecline(): void {
    const which = this.declining();

    if (which === 'reevaluation' || which === 'both') {
      this.reevaluationOutcome.set('declined');
    }
    if (which === 'communication' || which === 'both') {
      this.communicationOutcome.set('declined');
    }
    this.declining.set(null);
  }

  protected async createReevaluation(): Promise<void> {
    const observation = this.observation();
    const suggestion = this.reevaluation();

    if (observation === null || suggestion === null || !this.canCreate()) {
      return;
    }
    await this.run(async () => {
      await this.reevaluations.create({
        author: this.professional.read().name,
        createdAt: this.now().toISOString(),
        dueDate: suggestion.dueDate,
        observationId: observation.id,
        patientId: observation.patientId,
        reason: suggestion.reason,
        recipients: this.reevaluationRecipients(),
      });
      this.reevaluationOutcome.set('done');
    });
  }

  /** Só envia com a confirmação explícita, usando o texto como está no campo (editado ou não). */
  protected async sendMessage(): Promise<void> {
    const observation = this.observation();

    if (observation === null || !this.canSendMessage()) {
      return;
    }
    await this.run(async () => {
      await this.messages.send({
        at: this.now().toISOString(),
        author: this.professional.read().name,
        observationId: observation.id,
        patientId: observation.patientId,
        recipients: this.communicationRecipients(),
        text: this.draft().trim(),
      });
      this.communicationOutcome.set('done');
    });
  }

  protected close(): void {
    this.visible.set(false);
    this.closed.emit();
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.saving.set(true);
    this.failed.set(false);
    try {
      await action();
      this.changed.emit();
    } catch {
      this.failed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  private async load(observation: Observation): Promise<void> {
    this.reevaluationOutcome.set('pending');
    this.communicationOutcome.set('pending');
    this.declining.set(null);
    this.failed.set(false);
    try {
      const [suggestions, team] = await Promise.all([
        this.suggester.suggest(observation.text, observation.authorGroup, toIsoDate(this.now())),
        this.teamSource.list(observation.patientId),
      ]);

      if (this.observation() !== observation) {
        return;
      }
      this.team.set(team);
      this.reevaluation.set(suggestions.reevaluation);
      this.communication.set(suggestions.communication);
      this.reevaluationRecipients.set({ group: observation.authorGroup, people: [] });
      this.communicationRecipients.set({ group: suggestions.communication?.group ?? null, people: [] });
      this.draft.set(suggestions.communication?.draft ?? '');
      this.visible.set(suggestions.reevaluation !== null || suggestions.communication !== null);
    } catch {
      // IA indisponível: nenhuma sugestão; a observação segue registrada.
      this.visible.set(false);
    }
    if (!this.visible()) {
      this.closed.emit();
    }
  }
}
