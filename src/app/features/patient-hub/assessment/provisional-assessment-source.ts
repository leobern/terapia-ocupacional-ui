import { Injectable } from '@angular/core';

import { demoAssessment } from '../demo-clinical-data';
import {
  AssessmentFieldId,
  AssessmentPreviousValue,
  AssessmentValues,
  NutritionFunctionalAssessment,
} from './assessment.models';
import { AssessmentSource } from './assessment-source';
import { AssessmentWriter } from './assessment-writer';

/** Provisório: só o paciente `p1` tem avaliação anterior (permite exercitar os dois casos). */
const SEED: Readonly<Record<string, NutritionFunctionalAssessment | undefined>> = {
  p1: {
    previous: { weight: { at: '2026-05-20T12:00:00', value: '50,4' } },
    values: { handgrip: '14', height: '163', weight: '51,0' },
  },
};

/** Data de salvamento dos valores do exemplo de `p1`. */
const SEED_SAVED_AT = '2026-06-03T12:00:00';

/** Avaliação com a data em que cada valor atual foi salvo (para datar o "anterior" ao ser substituído). */
interface StoredAssessment {
  readonly assessment: NutritionFunctionalAssessment;
  readonly savedAt: Readonly<Partial<Record<AssessmentFieldId, string>>>;
}

function seedStored(patientId: string): StoredAssessment | undefined {
  const seed = SEED[patientId] ?? demoAssessment(patientId);

  if (!seed) {
    return undefined;
  }
  const savedAt: Partial<Record<AssessmentFieldId, string>> = {};

  for (const id of Object.keys(seed.values) as AssessmentFieldId[]) {
    savedAt[id] = SEED_SAVED_AT;
  }

  return { assessment: seed, savedAt };
}

/**
 * Provisório: guarda em memória a avaliação salva, para o Hub refletir na próxima abertura.
 * Ao regravar, o valor alterado de cada item vira o "anterior" (datado de quando foi salvo);
 * item inalterado mantém o seu "anterior"; item esvaziado deixa de existir. A API real fará o mesmo.
 */
@Injectable()
export class ProvisionalAssessmentSource extends AssessmentSource implements AssessmentWriter {
  private readonly saved = new Map<string, StoredAssessment>();

  loadLatest(patientId: string): Promise<NutritionFunctionalAssessment | null> {
    return Promise.resolve((this.saved.get(patientId) ?? seedStored(patientId))?.assessment ?? null);
  }

  save(patientId: string, values: AssessmentValues): Promise<void> {
    const current = this.saved.get(patientId) ?? seedStored(patientId);
    const now = new Date().toISOString();
    const previous: Partial<Record<AssessmentFieldId, AssessmentPreviousValue>> = {};
    const savedAt: Partial<Record<AssessmentFieldId, string>> = {};

    for (const id of Object.keys(values) as AssessmentFieldId[]) {
      const oldValue = current?.assessment.values[id];
      const oldAt = current?.savedAt[id];

      if (oldValue === undefined || oldAt === undefined) {
        savedAt[id] = now;
      } else if (oldValue === values[id]) {
        savedAt[id] = oldAt;
        const kept = current?.assessment.previous[id];

        if (kept) {
          previous[id] = kept;
        }
      } else {
        savedAt[id] = now;
        previous[id] = { at: oldAt, value: oldValue };
      }
    }
    this.saved.set(patientId, { assessment: { previous, values }, savedAt });

    return Promise.resolve();
  }
}
