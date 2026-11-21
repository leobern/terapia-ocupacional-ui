import { TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NutritionTargetsReader } from '../../patient-hub/plan/nutrition-targets-reader';
import { NutritionTargets } from '../../patient-hub/plan/plan-targets';
import { DailyAdequacy, DailyIntake } from './adequacy.models';
import { DailyAdequacyService } from './daily-adequacy.service';
import {
  FoodRecallSource,
  InfusedIntakeSource,
  ProvisionalFoodRecallSource,
  ProvisionalInfusedIntakeSource,
} from './intake-sources';

const TARGETS: NutritionTargets = {
  calorimetry: null,
  formula: 'simplified',
  kcalPerDay: 1875,
  kcalPerKg: 25,
  proteinPerDay: 112.5,
  proteinPerKg: 1.5,
  referenceWeight: { kg: 75, kind: 'current' },
};

function setup(opts: {
  food?: DailyIntake | null;
  infusion?: DailyIntake | null;
  online?: boolean;
  targets?: NutritionTargets | null;
}): DailyAdequacyService {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: NutritionTargetsReader,
        useValue: { current: (): Promise<NutritionTargets | null> => Promise.resolve(opts.targets ?? null) },
      },
      {
        provide: InfusedIntakeSource,
        useValue: { today: (): Promise<DailyIntake | null> => Promise.resolve(opts.infusion ?? null) },
      },
      {
        provide: FoodRecallSource,
        useValue: { today: (): Promise<DailyIntake | null> => Promise.resolve(opts.food ?? null) },
      },
    ],
  });
  TestBed.inject(ConnectivityService).online.set(opts.online ?? true);

  return TestBed.inject(DailyAdequacyService);
}

function percents(result: DailyAdequacy): readonly (number | string)[] {
  return result.status === 'available' ? [result.calories.percent, result.protein.percent] : [result.status];
}

describe('DailyAdequacyService', () => {
  it('soma infusão e recordatório e divide pela meta (calórico e proteico)', async () => {
    const result = await setup({
      food: { kcal: 300, proteinG: 10 },
      infusion: { kcal: 1425, proteinG: 82.5 },
      targets: TARGETS,
    }).calculate('p1');

    expect(result).toEqual({
      calories: { intake: 1725, percent: 92, target: 1875 },
      protein: { intake: 92.5, percent: 82, target: 112.5 },
      sources: { food: { kcal: 300, proteinG: 10 }, infusion: { kcal: 1425, proteinG: 82.5 } },
      status: 'available',
      targets: TARGETS,
    });
  });

  it('usa só a infusão quando não há recordatório', async () => {
    const result = await setup({ infusion: { kcal: 1425, proteinG: 82.5 }, targets: TARGETS }).calculate('p1');

    expect(percents(result)).toEqual([76, 73]);
  });

  it('usa só o recordatório quando não há infusão', async () => {
    const result = await setup({ food: { kcal: 937.5, proteinG: 56.25 }, targets: TARGETS }).calculate('p1');

    expect(percents(result)).toEqual([50, 50]);
  });

  it('recalcula somando o recordatório adicionado depois', async () => {
    const infusion = { kcal: 900, proteinG: 45 };
    const before = await setup({ infusion, targets: TARGETS }).calculate('p1');

    TestBed.resetTestingModule();
    const after = await setup({ food: { kcal: 450, proteinG: 22.5 }, infusion, targets: TARGETS }).calculate('p1');

    expect(percents(before)).toEqual([48, 40]);
    expect(percents(after)).toEqual([72, 60]);
  });

  it('sem aportes com meta definida o percentual é 0% calculado', async () => {
    expect(percents(await setup({ targets: TARGETS }).calculate('p1'))).toEqual([0, 0]);
  });

  it('sem meta vigente fica indisponível, nunca 0%', async () => {
    const result = await setup({ infusion: { kcal: 1000, proteinG: 50 } }).calculate('p1');

    expect(result).toEqual({ reason: 'no-target', status: 'unavailable' });
  });

  it('meta zerada também é indisponível (sem divisão por zero)', async () => {
    const result = await setup({ targets: { ...TARGETS, kcalPerDay: 0 } }).calculate('p1');

    expect(result).toEqual({ reason: 'no-target', status: 'unavailable' });
  });

  it('sem conexão fica indisponível', async () => {
    const result = await setup({ infusion: { kcal: 1, proteinG: 1 }, online: false, targets: TARGETS }).calculate('p1');

    expect(result).toEqual({ reason: 'offline', status: 'unavailable' });
  });
});

describe('fontes provisórias de aporte', () => {
  it('só o p1 tem infusão e não há recordatório', async () => {
    expect(await new ProvisionalInfusedIntakeSource().today('p1')).toEqual({ kcal: 1425, proteinG: 82.5 });
    expect(await new ProvisionalInfusedIntakeSource().today('p2')).toBeNull();
    expect(await new ProvisionalFoodRecallSource().today()).toBeNull();
  });
});
