import {
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
}
