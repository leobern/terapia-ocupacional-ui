export type GlimCriterionId = 'weight-loss' | 'low-bmi' | 'low-muscle-mass' | 'reduced-intake' | 'inflammation';

export type GlimCriterionState = 'positive' | 'negative' | 'not-evaluated';

export type GlimCriterionGroup = 'phenotypic' | 'etiologic';

export type GlimSeverity = 'moderate' | 'severe';

export interface GlimCriterionDefinition {
  readonly id: GlimCriterionId;
  readonly group: GlimCriterionGroup;
  readonly label: string;
}

/** Os 5 critérios do GLIM, na ordem do desenho (Figma 4685-9425): 3 fenotípicos e 2 etiológicos. */
export const GLIM_CRITERIA: readonly GlimCriterionDefinition[] = [
  { group: 'phenotypic', id: 'weight-loss', label: 'Perda de peso' },
  { group: 'phenotypic', id: 'low-bmi', label: 'IMC baixo' },
  { group: 'phenotypic', id: 'low-muscle-mass', label: 'Massa muscular reduzida' },
  { group: 'etiologic', id: 'reduced-intake', label: 'Ingestão ou assimilação reduzida' },
  { group: 'etiologic', id: 'inflammation', label: 'Doença ou inflamação' },
];

export const GLIM_STATE_LABELS: Readonly<Record<GlimCriterionState, string>> = {
  negative: 'Negativo',
  'not-evaluated': 'Não avaliado',
  positive: 'Positivo',
};

/**
 * Leitura dos dados já coletados na Avaliação Nutricional e Funcional (FT-004-4), com cada critério já
 * classificado. Os cortes-padrão do GLIM (fora de escopo, FR-018) ficam em quem produz a leitura, nunca
 * no motor. `severity` traz o grau de perda de peso e de IMC quando o critério correspondente é positivo.
 */
export interface GlimReading {
  /** Triagem positiva registrada (pré-requisito do cálculo). */
  readonly screeningPositive: boolean;
  readonly criteria: Readonly<Record<GlimCriterionId, GlimCriterionState>>;
  readonly severity: Readonly<Partial<Record<'weight-loss' | 'low-bmi', GlimSeverity>>>;
}

export type GlimOutcome = 'confirmed' | 'excluded' | 'indeterminate' | 'no-screening';

export interface GlimDiagnosis {
  readonly outcome: GlimOutcome;
  /** Só com resultado "confirmed" e grau conhecido de perda de peso ou IMC. */
  readonly staging: GlimSeverity | null;
}
