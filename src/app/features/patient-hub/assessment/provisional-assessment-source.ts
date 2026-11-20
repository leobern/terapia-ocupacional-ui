import { Injectable } from '@angular/core';

import { AssessmentValues, NutritionFunctionalAssessment } from './assessment.models';
import { AssessmentSource } from './assessment-source';
import { AssessmentWriter } from './assessment-writer';

/** Provisório: só o paciente `p1` tem avaliação anterior (permite exercitar os dois casos). */
const SEED: Readonly<Record<string, NutritionFunctionalAssessment | undefined>> = {
  p1: {
    previous: { weight: { at: '2026-05-20T12:00:00', value: '50,4' } },
    values: { handgrip: '14', height: '163', weight: '51,0' },
  },
};

/** Provisório: guarda em memória a avaliação salva, para o Hub refletir na próxima abertura. */
@Injectable()
export class ProvisionalAssessmentSource extends AssessmentSource implements AssessmentWriter {
  private readonly saved = new Map<string, NutritionFunctionalAssessment>();

  loadLatest(patientId: string): Promise<NutritionFunctionalAssessment | null> {
    return Promise.resolve(this.saved.get(patientId) ?? SEED[patientId] ?? null);
  }

  save(patientId: string, values: AssessmentValues): Promise<void> {
    this.saved.set(patientId, { previous: {}, values });

    return Promise.resolve();
  }
}
