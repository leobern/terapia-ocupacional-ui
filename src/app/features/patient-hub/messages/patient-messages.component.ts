import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { formatRecordTime, PatientRecord } from './patient-message.models';
import { PatientMessageSource } from './patient-message-source';

export const MESSAGES_LOAD_FAILED_HINT = 'Não foi possível carregar os registros. Os já exibidos foram mantidos.';

/**
 * Observações do paciente no Hub (FT-005-1): um card por observação (registro sem destinatário), do mais
 * recente ao mais antigo, só leitura (imutáveis). As mensagens direcionadas são threads e aparecem em
 * "Mensagens" (`app-patient-threads`); a seção some enquanto não há observação.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-patient-messages',
  styleUrl: './patient-messages.component.scss',
  templateUrl: './patient-messages.component.html',
})
export class PatientMessagesComponent {
  readonly patientId = input.required<string>();
  /** Muda a cada registro gravado; faz a lista recarregar. */
  readonly refreshKey = input(0);

  protected readonly loaded = signal<readonly PatientRecord[]>([]);
  protected readonly records = computed(() => this.loaded().filter(record => record.recipients.length === 0));
  protected readonly loadFailed = signal(false);
  protected readonly loadFailedHint = MESSAGES_LOAD_FAILED_HINT;

  private readonly source = inject(PatientMessageSource);
  private token = 0;

  constructor() {
    effect(() => {
      const id = this.patientId();

      this.refreshKey();
      untracked(() => void this.load(id));
    });
  }

  protected time(iso: string): string {
    return formatRecordTime(iso);
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;

    try {
      const loaded = await this.source.list(patientId);

      if (token === this.token) {
        this.loaded.set(loaded);
        this.loadFailed.set(false);
      }
    } catch {
      // Offline ou falha: mantém os cards já carregados.
      if (token === this.token) {
        this.loadFailed.set(true);
      }
    }
  }
}
