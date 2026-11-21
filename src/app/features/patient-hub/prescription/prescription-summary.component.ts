import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatNumber } from '../plan/plan-targets';
import { modalityLabel, Prescription, scheduleText } from './prescription.models';

/**
 * Prescrição vigente em leitura (FT-004-8; Figma 4718-10198, seção "Prescrição ativa"): usada no Hub e na
 * Evolução Diária, onde horários previstos e orientações de enfermagem ficam visíveis (FR-009).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-prescription-summary',
  styleUrl: './prescription-summary.component.scss',
  templateUrl: './prescription-summary.component.html',
})
export class PrescriptionSummaryComponent {
  readonly prescription = input<Prescription | null>(null);
  readonly title = input('Prescrição ativa');

  protected readonly lines = computed(() => {
    const p = this.prescription();

    return p === null
      ? null
      : {
          formula: p.formulaName,
          modality: modalityLabel(p.modality),
          notes: p.nursingNotes,
          schedule: scheduleText(p),
          volume: `${formatNumber(p.volumeMl)} mL/dia`,
        };
  });
}
