import { Formula } from './formulas.models';

/**
 * Fronteira do catálogo de fórmulas e da padronização por hospital (FR-004..FR-006).
 * A API real substitui `ProvisionalFormulasApi` em `app.config.ts`.
 */
export abstract class FormulasApi {
  /** Catálogo compartilhado, com `standardized` calculado para o hospital. */
  abstract list(hospitalId: number): Promise<readonly Formula[]>;
  /** Padroniza/desmarca a fórmula só no hospital informado; rejeita em caso de falha. */
  abstract setStandardized(hospitalId: number, formulaId: string, standardized: boolean): Promise<void>;
  /** Registra o pedido de inclusão de fórmula nova (hospital, descrição); tratado manualmente pela equipe, sem fluxo de aprovação (FR-009). */
  abstract requestFormula(hospitalId: number, description: string): Promise<void>;
}
