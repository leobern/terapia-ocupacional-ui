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

/** Resultado categórico de outro protocolo, calculado por motor próprio (fora desta feature, FR-017). */
export interface ProtocolResult {
  readonly id: 'nrs-2002' | 'sarc-f' | 'sarcopenia-confirmatory';
  readonly label: string;
  /** Categoria em texto (ex.: "Risco", "Pouco provável"). */
  readonly result: string;
  /** Pontuação, quando o protocolo tem. */
  readonly points?: number;
}

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
  /** Ascite ou edema registrado: peso, IMC e massa muscular podem estar mascarados. */
  readonly fluidRetention: boolean;
  /** Protocolos aplicados ao paciente; protocolo não aplicado simplesmente não aparece. */
  readonly protocols: readonly ProtocolResult[];
}

export type GlimOutcome = 'confirmed' | 'excluded' | 'indeterminate' | 'no-screening';

export interface GlimDiagnosis {
  readonly outcome: GlimOutcome;
  /** Só com resultado "confirmed" e grau conhecido de perda de peso ou IMC. */
  readonly staging: GlimSeverity | null;
}

/** Resultado do GLIM exibido ou decidido: o calculado pelo motor ou o alterado pelo médico. */
export interface GlimResult {
  readonly outcome: Exclude<GlimOutcome, 'no-screening'>;
  readonly staging: GlimSeverity | null;
  readonly criteria: Readonly<Record<GlimCriterionId, GlimCriterionState>>;
}

export type DiagnosisAction = 'confirm' | 'exclude' | 'alter';

/** Registro imutável da trilha de auditoria (Constituição, Princípio V). `before`/`after` só em "alter". */
export interface DiagnosisAuditEntry {
  readonly action: DiagnosisAction;
  readonly author: string;
  /** ISO 8601. */
  readonly at: string;
  readonly before: GlimResult | null;
  readonly after: GlimResult | null;
}

/** Decisão final do médico: confirmada (passa a valer) ou excluída. */
export interface DiagnosisDecision {
  readonly status: 'confirmed' | 'excluded';
  readonly author: string;
  readonly at: string;
  /** Resultado que passou a valer (na exclusão, o último exibido). */
  readonly result: GlimResult;
}

/** Estado persistido por paciente/internação; é o que a FT-004-6 consome, sem nova coleta. */
export interface DiagnosisRecord {
  readonly decision: DiagnosisDecision | null;
  /** Resultado alterado pelo médico, ainda não confirmado; nunca sobrescrito por recálculo. */
  readonly override: GlimResult | null;
  readonly audit: readonly DiagnosisAuditEntry[];
}

export interface DiagnosisActionRequest {
  readonly patientId: string;
  readonly action: DiagnosisAction;
  readonly author: string;
  readonly at: string;
  /** Resultado exibido no momento da ação (calculado ou alterado). */
  readonly current: GlimResult;
  /** Novo resultado, só em "alter". */
  readonly altered?: GlimResult;
}
