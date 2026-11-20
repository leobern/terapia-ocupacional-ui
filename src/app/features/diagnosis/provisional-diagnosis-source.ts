import { Injectable } from '@angular/core';

import { GlimReading } from './diagnosis.models';
import { DiagnosisSource } from './diagnosis-source';

const NO_DATA: GlimReading = {
  criteria: {
    inflammation: 'not-evaluated',
    'low-bmi': 'not-evaluated',
    'low-muscle-mass': 'not-evaluated',
    'reduced-intake': 'not-evaluated',
    'weight-loss': 'not-evaluated',
  },
  screeningPositive: false,
  severity: {},
};

/** Provisório: `p1` tem triagem positiva e critérios para "Confirmada/moderada"; os demais, sem triagem. */
const SEED: Readonly<Record<string, GlimReading | undefined>> = {
  p1: {
    criteria: {
      inflammation: 'positive',
      'low-bmi': 'negative',
      'low-muscle-mass': 'not-evaluated',
      'reduced-intake': 'positive',
      'weight-loss': 'positive',
    },
    screeningPositive: true,
    severity: { 'weight-loss': 'moderate' },
  },
};

@Injectable()
export class ProvisionalDiagnosisSource extends DiagnosisSource {
  load(patientId: string): Promise<GlimReading> {
    return Promise.resolve(SEED[patientId] ?? NO_DATA);
  }
}
