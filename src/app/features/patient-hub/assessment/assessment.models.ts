export type AssessmentSectionId = 'nutritional' | 'functional';

export type AssessmentFieldId = 'weight' | 'height' | 'handgrip' | 'dysphagia';

export interface AssessmentFieldDefinition {
  readonly id: AssessmentFieldId;
  readonly label: string;
  readonly placeholder: string;
  /** Texto de ajuda do card (Figma 4682-9078). */
  readonly help: string;
  /** Campo de seleção (com seta), não digitação; as opções vêm de `options`. */
  readonly options?: readonly string[];
  /** Unidade exibida na ajuda "Anterior: ...". */
  readonly unit?: string;
}

export interface AssessmentSectionDefinition {
  readonly id: AssessmentSectionId;
  readonly title: string;
  readonly fields: readonly AssessmentFieldDefinition[];
}

/**
 * Opções do risco de disfagia. Formato real (sim/não, escala, protocolo) a confirmar com Michelle:
 * a lista fica só aqui para troca fácil.
 */
export const DYSPHAGIA_OPTIONS: readonly string[] = ['Sem risco', 'Risco baixo', 'Risco moderado', 'Risco alto'];

/** Campos do desenho (Figma 4682-9078); os demais campos da FT-004-4 entram em outras stories. */
export const ASSESSMENT_SECTIONS: readonly AssessmentSectionDefinition[] = [
  {
    fields: [
      { help: 'Peso atual do paciente.', id: 'weight', label: 'Peso (kg)', placeholder: 'Ex.: 51,0', unit: 'kg' },
      { help: 'Usada no cálculo do IMC.', id: 'height', label: 'Altura (cm)', placeholder: 'Ex.: 163', unit: 'cm' },
    ],
    id: 'nutritional',
    title: 'Avaliação nutricional',
  },
  {
    fields: [
      { help: 'Média de três medidas.', id: 'handgrip', label: 'Handgrip (kgf)', placeholder: 'Ex.: 14', unit: 'kgf' },
      {
        help: 'Usado no Plano de Intervenção.',
        id: 'dysphagia',
        label: 'Risco de disfagia',
        placeholder: 'Selecione',
        options: DYSPHAGIA_OPTIONS,
      },
    ],
    id: 'functional',
    title: 'Avaliação funcional',
  },
];

/** Valor da rodada anterior de um campo, com a data (ISO) em que foi aferido. */
export interface AssessmentPreviousValue {
  readonly value: string;
  /** ISO 8601 */
  readonly at: string;
}

/** Avaliação Nutricional e Funcional mais recente do paciente; campo ausente = não preenchido. */
export interface NutritionFunctionalAssessment {
  readonly values: Readonly<Partial<Record<AssessmentFieldId, string>>>;
  /** Valor anterior de cada item dinâmico, para a ajuda "Anterior: ...". */
  readonly previous: Readonly<Partial<Record<AssessmentFieldId, AssessmentPreviousValue>>>;
}

/** Valores a gravar: só campos preenchidos (campo vazio = ausente), exatamente como digitados. */
export type AssessmentValues = Readonly<Partial<Record<AssessmentFieldId, string>>>;
