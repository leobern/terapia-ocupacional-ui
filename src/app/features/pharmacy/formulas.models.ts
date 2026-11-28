export type FormulaCategory =
  'enteral' | 'parenteral' | 'modulo-proteico' | 'suplemento-oral' | 'espessante' | 'medicamento';

export const FORMULA_CATEGORIES: readonly { readonly key: FormulaCategory; readonly label: string }[] = [
  { key: 'enteral', label: 'Enterais' },
  { key: 'parenteral', label: 'Parenterais' },
  { key: 'modulo-proteico', label: 'Módulos proteicos' },
  { key: 'suplemento-oral', label: 'Suplementos orais' },
  { key: 'espessante', label: 'Espessantes' },
  { key: 'medicamento', label: 'Medicamentos' },
];

/** Base das densidades: por mL (líquidos) ou por grama (pós e módulos). */
export type FormulaUnit = 'ml' | 'g';

/** Pedido de inclusão de fórmula já enviado pelo hospital (sem status: o cadastro é manual, FR-009). */
export interface FormulaRequest {
  readonly id: string;
  readonly description: string;
  /** Data e hora do envio (ISO). */
  readonly createdAt: string;
}

/** Fórmula do catálogo compartilhado (FR-002/FR-003); `null` = não se aplica ou não informado (exibido "N/A"). */
export interface Formula {
  readonly id: string;
  readonly name: string;
  readonly category: FormulaCategory;
  readonly manufacturer: string | null;
  readonly presentation: string | null;
  readonly unit: FormulaUnit;
  /** kcal por mL (por g quando `unit` é `g`). */
  readonly kcalPerMl: number | null;
  /** Proteína em g por mL (por g quando `unit` é `g`). */
  readonly proteinPerMl: number | null;
  readonly fiber: boolean | null;
  readonly sucrose: boolean | null;
  readonly lactose: boolean | null;
  readonly gluten: boolean | null;
  readonly route: string | null;
  readonly packaging: string | null;
  /** Padronizada no hospital consultado (FR-004). */
  readonly standardized: boolean;
}
