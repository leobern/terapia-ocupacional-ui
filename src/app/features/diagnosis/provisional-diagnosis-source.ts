import { Injectable } from '@angular/core';

import { demoDiagnosis } from '../patient-hub/demo-clinical-data';
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
  fluidRetention: false,
  protocols: [],
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
    fluidRetention: true,
    protocols: [
      { id: 'nrs-2002', label: 'NRS-2002', points: 4, result: 'Risco' },
      { id: 'sarc-f', label: 'SARC-F', points: 4, result: 'Risco' },
    ],
    screeningPositive: true,
    severity: { 'weight-loss': 'moderate' },
  },
};

@Injectable()
export class ProvisionalDiagnosisSource extends DiagnosisSource {
  load(patientId: string): Promise<GlimReading> {
    return Promise.resolve(SEED[patientId] ?? demoDiagnosis(patientId) ?? NO_DATA);
  }
}
