import {
  CatalogNutritionIndicatorId,
  NutritionHistoryDeletion,
  NutritionHistoryEntry,
  NutritionIndicatorId,
  NutritionManualValues,
  NutritionValueEdit,
} from './nutrition-panel.models';

/**
 * Porta de leitura do histórico de um card, específico da internação atual (FR-017), e dos valores
 * informados manualmente. A implementação real (backend) substitui a provisória em `app.config.ts`.
 */
export abstract class NutritionHistorySource {
  /** Entradas do histórico, da mais recente para a mais antiga. */
  abstract load(patientId: string, indicator: NutritionIndicatorId): Promise<readonly NutritionHistoryEntry[]>;
  abstract loadManual(patientId: string): Promise<NutritionManualValues>;
}

/**
 * Porta de escrita: grava o novo valor, move o anterior ao histórico e registra a trilha de auditoria
 * (autor, data/hora, indicador, valor anterior e novo). Rejeita a promessa se não conseguir gravar.
 */
export abstract class NutritionValueWriter {
  abstract save(edit: NutritionValueEdit): Promise<void>;
  /**
   * Apaga uma entrada só da visualização do histórico e registra a exclusão na trilha de auditoria
   * (autor, data/hora, indicador, entrada apagada); a trilha nunca perde registros. Não altera o
   * valor atual. Rejeita a promessa se não conseguir gravar.
   */
  abstract deleteEntry(deletion: NutritionHistoryDeletion): Promise<void>;
}

/**
 * Porta dos cards adicionados ao painel pelo "+" (US5): leitura e gravação por paciente. Um tipo do
 * catálogo entra no máximo uma vez. Rejeita a promessa se não conseguir gravar.
 */
export abstract class NutritionAddedCards {
  /** Tipos adicionados, na ordem em que foram adicionados. */
  abstract loadAdded(patientId: string): Promise<readonly CatalogNutritionIndicatorId[]>;
  abstract add(patientId: string, type: CatalogNutritionIndicatorId): Promise<void>;
}

/**
 * Porta da visibilidade dos cards do painel (US6): guarda por paciente quais cards estão ocultos da
 * grid. Ocultar nunca apaga valor atual nem histórico (FR-015). Rejeita a promessa se não conseguir gravar.
 */
export abstract class NutritionHiddenCards {
  /** Indicadores ocultos (fixos ou do catálogo). */
  abstract loadHidden(patientId: string): Promise<readonly NutritionIndicatorId[]>;
  abstract setHidden(patientId: string, indicator: NutritionIndicatorId, hidden: boolean): Promise<void>;
}
