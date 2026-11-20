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
