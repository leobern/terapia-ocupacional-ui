import { NutritionTargets } from '../../patient-hub/plan/plan-targets';

/** Aporte do dia em kcal e gramas de proteína, vindo de uma fonte (infusão ou recordatório). */
export interface DailyIntake {
  readonly kcal: number;
  readonly proteinG: number;
}

/** Adequação de um nutriente: aporte somado, meta usada e percentual (inteiro, arredondado). */
export interface NutrientAdequacy {
  readonly intake: number;
  readonly percent: number;
  readonly target: number;
}

export type AdequacyUnavailableReason = 'no-target' | 'offline';

/** Resultado único do dia: percentual com os dados usados (rastreabilidade) ou indisponível (nunca 0%). */
export type DailyAdequacy =
  | { readonly status: 'unavailable'; readonly reason: AdequacyUnavailableReason }
  | {
      readonly status: 'available';
      readonly calories: NutrientAdequacy;
      readonly protein: NutrientAdequacy;
      /** Fontes usadas; `null` = fonte ausente (não entrou na soma). */
      readonly sources: { readonly food: DailyIntake | null; readonly infusion: DailyIntake | null };
      readonly targets: NutritionTargets;
    };

const nutrient = (intake: number, target: number): NutrientAdequacy => ({
  intake,
  percent: Math.round((intake / target) * 100),
  target,
});

/** Soma os aportes presentes e divide pela meta (FT-004-7, FR-008). Não decide volumes nem metas (FR-018). */
export function computeAdequacy(
  targets: NutritionTargets | null,
  infusion: DailyIntake | null,
  food: DailyIntake | null,
): DailyAdequacy {
  if (targets === null || targets.kcalPerDay <= 0 || targets.proteinPerDay <= 0) {
    return { reason: 'no-target', status: 'unavailable' };
  }
  const kcal = (infusion?.kcal ?? 0) + (food?.kcal ?? 0);
  const proteinG = (infusion?.proteinG ?? 0) + (food?.proteinG ?? 0);

  return {
    calories: nutrient(kcal, targets.kcalPerDay),
    protein: nutrient(proteinG, targets.proteinPerDay),
    sources: { food, infusion },
    status: 'available',
    targets,
  };
}

/** Valores do Painel Nutricional derivados do resultado; indisponível = ausente ("Sem dados"). */
export function adequacyPanelValues(adequacy: DailyAdequacy | null): {
  readonly 'calorie-adequacy'?: string;
  readonly 'protein-adequacy'?: string;
} {
  return adequacy?.status === 'available'
    ? {
        'calorie-adequacy': `${adequacy.calories.percent}%`,
        'protein-adequacy': `${adequacy.protein.percent}%`,
      }
    : {};
}
