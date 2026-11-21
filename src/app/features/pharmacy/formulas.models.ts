export type FormulaCategory = 'enteral' | 'parenteral' | 'suplemento-oral' | 'medicamento';

export const FORMULA_CATEGORIES: readonly { readonly key: FormulaCategory; readonly label: string }[] = [
  { key: 'enteral', label: 'Enterais' },
  { key: 'parenteral', label: 'Parenterais' },
  { key: 'suplemento-oral', label: 'Suplementos orais' },
  { key: 'medicamento', label: 'Medicamentos' },
];

/** Fórmula do catálogo compartilhado (FR-002/FR-003); `null` = atributo não se aplica. */
export interface Formula {
  readonly id: string;
  readonly name: string;
  readonly category: FormulaCategory;
  readonly kcalPerMl: number | null;
  readonly proteinPerMl: number | null;
  readonly fiber: boolean;
  readonly sucrose: boolean;
  readonly lactose: boolean;
  readonly gluten: boolean;
  readonly vegetarian: boolean;
  readonly vegan: boolean;
  /** Padronizada no hospital consultado (FR-004). */
  readonly standardized: boolean;
}
