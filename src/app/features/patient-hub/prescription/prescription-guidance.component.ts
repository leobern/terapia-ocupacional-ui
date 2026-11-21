import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';

import { Prescription } from './prescription.models';
import { PrescriptionSource } from './prescription-source';
import { PrescriptionSummaryComponent } from './prescription-summary.component';

/**
 * Horários previstos e orientações de enfermagem da prescrição vigente, para quem registra a Evolução
 * Diária (FT-004-8, FR-009). Lê a cada abertura; falha ou ausência de prescrição não exibe nada.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PrescriptionSummaryComponent],
  selector: 'app-prescription-guidance',
  template: '<app-prescription-summary title="Prescrição vigente" [prescriptions]="prescriptions()" />',
})
export class PrescriptionGuidanceComponent {
  readonly open = input(false);
  readonly patientId = input.required<string>();

  protected readonly prescriptions = signal<readonly Prescription[]>([]);

  private readonly source = inject(PrescriptionSource);
  private token = 0;

  constructor() {
    effect(() => {
      if (this.open()) {
        const id = this.patientId();

        untracked(() => void this.load(id));
      }
    });
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;

    try {
      const loaded = await this.source.load(patientId);

      if (token === this.token) {
        this.prescriptions.set(loaded);
      }
    } catch {
      if (token === this.token) {
        this.prescriptions.set([]);
      }
    }
  }
}
