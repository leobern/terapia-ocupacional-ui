import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';

import { formatRecordTime, PatientRecord } from './patient-message.models';
import { PatientMessageSource } from './patient-message-source';

export const MESSAGES_EMPTY_TEXT = 'Nenhum registro ainda. Use as ações da tela para registrar uma observação.';
export const MESSAGES_LOAD_FAILED_HINT = 'Não foi possível carregar os registros. Os já exibidos foram mantidos.';

/**
 * Cards dos registros do paciente no Hub (FT-005-1): um card por observação ou mensagem, do mais recente
 * ao mais antigo, só leitura (imutáveis). Responder e resolver pertencem a outras histórias.
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

  protected readonly records = signal<readonly PatientRecord[]>([]);
  protected readonly loadFailed = signal(false);
  protected readonly emptyText = MESSAGES_EMPTY_TEXT;
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

  protected names(record: PatientRecord): string {
    return record.recipients.map(r => r.name).join(', ');
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;

    try {
      const loaded = await this.source.list(patientId);

      if (token === this.token) {
        this.records.set(loaded);
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
