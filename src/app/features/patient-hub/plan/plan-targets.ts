import { KCAL_PER_KG } from '../assessment/assessment.models';

/** Pesos já calculados na Avaliação Nutricional e Funcional (FT-004-4) que servem de referência. */
export type ReferenceWeightKind = 'ideal' | 'adjusted' | 'dry' | 'current';

export const REFERENCE_WEIGHT_OPTIONS: readonly { readonly id: ReferenceWeightKind; readonly label: string }[] = [
  { id: 'ideal', label: 'Ideal' },
  { id: 'adjusted', label: 'Ajustado' },
  { id: 'dry', label: 'Seco' },
  { id: 'current', label: 'Atual' },
];

/** Pesos calculados em kg; peso ausente = não existe para o paciente. */
export type CalculatedWeights = Readonly<Partial<Record<ReferenceWeightKind, number>>>;

export interface ReferenceWeight {
  readonly kg: number;
  readonly kind: ReferenceWeightKind;
}

export interface ReferenceWeightSaveRequest {
  readonly at: string;
  readonly author: string;
  readonly patientId: string;
  readonly weight: ReferenceWeight;
}

/** Fator proteico padrão (valor do Figma 4716-9503); a confirmar com a equipe clínica. */
export const PROTEIN_PER_KG = 1.5;
export const DEFAULT_KCAL_PER_KG = KCAL_PER_KG;
/** Percentual inicial sugerido da calorimetria (exemplo da spec, cautela de realimentação); editável. */
export const DEFAULT_CALORIMETRY_PERCENT = 70;
/** Limite razoável do percentual da calorimetria (a confirmar com a equipe clínica). */
export const MAX_CALORIMETRY_PERCENT = 150;

export type TargetFormula = 'simplified' | 'indirect-calorimetry';

export const TARGET_FORMULA_LABELS: Readonly<Record<TargetFormula, string>> = {
  'indirect-calorimetry': 'Percentual da calorimetria indireta',
  simplified: 'Fórmula simplificada (kcal/kg)',
};

/** Metas vigentes do paciente, com a fórmula e os dados de entrada (rastreabilidade). */
export interface NutritionTargets {
  /** Presente só quando a origem é a calorimetria. */
  readonly calorimetry: { readonly kcal: number; readonly percent: number } | null;
  readonly formula: TargetFormula;
  readonly kcalPerDay: number;
  readonly kcalPerKg: number;
  readonly proteinPerDay: number;
  readonly proteinPerKg: number;
  readonly referenceWeight: ReferenceWeight;
}

export interface TargetsSaveRequest {
  readonly at: string;
  readonly author: string;
  readonly patientId: string;
  readonly targets: NutritionTargets;
}

export interface TargetsInput {
  readonly calorimetry: { readonly kcal: number; readonly percent: number } | null;
  readonly kcalPerKg: number;
  readonly proteinPerKg: number;
  readonly referenceWeight: ReferenceWeight;
}

/** Aceita vírgula ou ponto; devolve `null` para vazio, zero, negativo ou não numérico. */
export function parsePositive(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  const value = /^\d+(\.\d+)?$/u.test(normalized) ? Number(normalized) : Number.NaN;

  return Number.isFinite(value) && value > 0 ? value : null;
}

const round = (value: number, digits: number): number => Math.round(value * 10 ** digits) / 10 ** digits;

/** Meta proteica sempre por kg; meta calórica por kg (simplificada) ou pelo percentual da calorimetria. */
export function computeTargets(input: TargetsInput): NutritionTargets {
  const kg = input.referenceWeight.kg;
  const kcalPerDay = input.calorimetry
    ? Math.round((input.calorimetry.kcal * input.calorimetry.percent) / 100)
    : Math.round(kg * input.kcalPerKg);

  return {
    calorimetry: input.calorimetry,
    formula: input.calorimetry ? 'indirect-calorimetry' : 'simplified',
    kcalPerDay,
    kcalPerKg: input.calorimetry ? round(kcalPerDay / kg, 1) : input.kcalPerKg,
    proteinPerDay: round(kg * input.proteinPerKg, 1),
    proteinPerKg: input.proteinPerKg,
    referenceWeight: input.referenceWeight,
  };
}

/** Número em pt-BR: milhar com ponto, decimais com vírgula. */
export function formatNumber(value: number, minDigits = 0, maxDigits = 1): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: maxDigits, minimumFractionDigits: minDigits });
}

export function formatWeight(kg: number): string {
  return `${formatNumber(kg, 1, 2)} kg`;
}

export function referenceWeightLabel(weight: ReferenceWeight): string {
  const name = REFERENCE_WEIGHT_OPTIONS.find(o => o.id === weight.kind)?.label ?? '';

  return `${name} · ${formatWeight(weight.kg)}`;
}
