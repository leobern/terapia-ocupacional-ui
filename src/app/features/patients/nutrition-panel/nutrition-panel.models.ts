/** Indicadores fixos do Painel Nutricional (FT-004-3, FR-001), na ordem de exibição. */
export const FIXED_NUTRITION_INDICATORS = [
  { id: 'weight', label: 'Peso' },
  { id: 'bmi', label: 'IMC' },
  { id: 'nrs-2002', label: 'NRS-2002' },
  { id: 'glim', label: 'GLIM' },
  { id: 'sarc-f', label: 'SARC-F' },
  { id: 'therapy-type', label: 'Tipo de terapia nutricional' },
  { id: 'calorie-adequacy', label: '% adequação calórica' },
  { id: 'protein-adequacy', label: '% adequação proteica' },
] as const;

export type NutritionIndicatorId = (typeof FIXED_NUTRITION_INDICATORS)[number]['id'];

/** Valor atual por indicador; ausente (ou vazio) significa "Sem dados". */
export type NutritionValues = Partial<Record<NutritionIndicatorId, string | null>>;

/** Unidade exibida no rótulo do campo de edição; indicador sem unidade fica de fora. */
export const NUTRITION_UNITS: Partial<Record<NutritionIndicatorId, string>> = {
  bmi: 'kg/m²',
  'calorie-adequacy': '%',
  'protein-adequacy': '%',
  weight: 'kg',
};

/** Origem de um valor: inserido manualmente ou resultado de outra feature (protocolo/prescrição). */
export type NutritionValueOrigin = 'manual' | 'result';

/** Valor atual de um card, com origem e (quando conhecida) data/hora ISO. */
export interface NutritionCurrent {
  readonly at: string | null;
  readonly origin: NutritionValueOrigin;
  readonly value: string;
}

/** Entrada do histórico de um card na internação atual (mais recente primeiro). */
export interface NutritionHistoryEntry {
  readonly at: string;
  readonly origin: NutritionValueOrigin;
  readonly value: string;
}

/** Alteração do valor de um card: o anterior (se havia) vai ao histórico; vira registro de auditoria. */
export interface NutritionValueEdit {
  readonly at: string;
  readonly author: string;
  readonly indicator: NutritionIndicatorId;
  readonly newOrigin: NutritionValueOrigin;
  readonly patientId: string;
  readonly previous: NutritionCurrent | null;
  readonly value: string;
}

export type NutritionManualValues = Partial<Record<NutritionIndicatorId, NutritionCurrent>>;
