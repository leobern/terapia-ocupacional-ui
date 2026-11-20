import { Injectable } from '@angular/core';

import { NutritionFunctionalAssessment } from './assessment.models';
import { AssessmentSource } from './assessment-source';

/** Provisório: só o paciente `p1` tem avaliação anterior (permite exercitar os dois casos). */
const SEED: Readonly<Record<string, NutritionFunctionalAssessment | undefined>> = {
  p1: {
    previous: { weight: { at: '2026-05-20T12:00:00', value: '50,4' } },
    values: { handgrip: '14', height: '163', weight: '51,0' },
  },
};

@Injectable()
export class ProvisionalAssessmentSource extends AssessmentSource {
  loadLatest(patientId: string): Promise<NutritionFunctionalAssessment | null> {
    return Promise.resolve(SEED[patientId] ?? null);
  }
}
