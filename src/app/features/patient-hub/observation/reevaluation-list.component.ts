import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import {
  DirectedMessage,
  formatIsoDate,
  isOverdue,
  OFFLINE_OBSERVATION_HINT,
  Recipients,
  recipientsLabel,
  Reevaluation,
  TeamMember,
  validateRecipients,
} from './observation.models';
import { DirectedMessageSource, PatientTeamSource, ReevaluationSource, ReevaluationWriter } from './observation-source';
import { RecipientsEditorComponent } from './recipients-editor.component';

/**
 * Pendências de reavaliação e mensagens direcionadas do paciente, no Hub. Pendência vencida (prazo passado e
 * não resolvida) mostra o selo "Vencida" com texto; nada além do indicador visual (FR-014f).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, RecipientsEditorComponent],
  selector: 'app-reevaluation-list',
  styleUrl: './reevaluation-list.component.scss',
  templateUrl: './reevaluation-list.component.html',
})
export class ReevaluationListComponent {
  readonly patientId = input.required<string>();
  /** Muda quando algo foi criado/enviado fora da lista: recarrega. */
  readonly version = input(0);

  protected readonly online = inject(ConnectivityService).online;
  protected readonly offlineHint = OFFLINE_OBSERVATION_HINT;
  protected readonly items = signal<readonly Reevaluation[]>([]);
  protected readonly messages = signal<readonly DirectedMessage[]>([]);
  protected readonly team = signal<readonly TeamMember[]>([]);
  protected readonly editingId = signal<string | null>(null);
  protected readonly draft = signal<Recipients>({ group: null, people: [] });
  protected readonly failed = signal(false);
  protected readonly empty = computed(() => this.items().length === 0 && this.messages().length === 0);
  protected readonly canSave = computed(() => this.online() && validateRecipients(this.draft(), this.team()) === null);
  protected readonly formatIsoDate = formatIsoDate;
  protected readonly recipientsLabel = recipientsLabel;

  private readonly source = inject(ReevaluationSource);
  private readonly messageSource = inject(DirectedMessageSource);
  private readonly teamSource = inject(PatientTeamSource);
  private readonly writer = inject(ReevaluationWriter);
  private readonly professional = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);

  constructor() {
    effect(() => {
      this.version();
      const id = this.patientId();

      untracked(() => void this.reload(id));
    });
  }

  protected overdue(item: Reevaluation): boolean {
    return isOverdue(item, this.now());
  }

  protected startEdit(item: Reevaluation): void {
    this.draft.set(item.recipients);
    this.editingId.set(item.id);
  }

  protected setDraft(value: Recipients): void {
    this.draft.set(value);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected async saveRecipients(item: Reevaluation): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    await this.run(async () => {
      await this.writer.changeRecipients({
        at: this.now().toISOString(),
        author: this.professional.read().name,
        id: item.id,
        recipients: this.draft(),
      });
      this.editingId.set(null);
    });
  }

  protected async resolve(item: Reevaluation): Promise<void> {
    if (!this.online() || item.resolvedAt !== null) {
      return;
    }
    await this.run(async () => {
      await this.writer.resolve({ at: this.now().toISOString(), author: this.professional.read().name, id: item.id });
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.failed.set(false);
    try {
      await action();
      await this.reload(this.patientId());
    } catch {
      this.failed.set(true);
    }
  }

  private async reload(patientId: string): Promise<void> {
    try {
      const [items, messages, team] = await Promise.all([
        this.source.list(patientId),
        this.messageSource.listMessages(patientId),
        this.teamSource.list(patientId),
      ]);

      this.items.set(items);
      this.messages.set(messages);
      this.team.set(team);
    } catch {
      // mantém o que já está exibido
    }
  }
}
