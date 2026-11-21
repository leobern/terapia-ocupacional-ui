import { TestBed } from '@angular/core/testing';

import { NutritionTargetsReader, PlanNutritionTargetsReader } from './nutrition-targets-reader';
import { PlanSource } from './plan-source';
import { ProvisionalPlanSource } from './provisional-plan-source';

describe('NutritionTargetsReader', () => {
  it('devolve nulo sem metas e as metas vigentes depois de salvas, sem nova coleta', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PlanSource, useClass: ProvisionalPlanSource },
        { provide: NutritionTargetsReader, useClass: PlanNutritionTargetsReader },
      ],
    });
    const reader = TestBed.inject(NutritionTargetsReader);
    const source = TestBed.inject(PlanSource);
    const targets = {
      calorimetry: null,
      formula: 'simplified',
      kcalPerDay: 1875,
      kcalPerKg: 25,
      proteinPerDay: 112.5,
      proteinPerKg: 1.5,
      referenceWeight: { kg: 75, kind: 'current' },
    } as const;

    expect(await reader.current('p1')).toBeNull();
    await source.saveTargets({ at: 'x', author: 'A', patientId: 'p1', targets });

    expect(await reader.current('p1')).toEqual(targets);
  });
});
