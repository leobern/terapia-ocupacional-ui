import { Injectable } from '@angular/core';

import { NutritionHistorySource, NutritionValueWriter } from './nutrition-card-ports';
import {
  NutritionHistoryEntry,
  NutritionIndicatorId,
  NutritionManualValues,
  NutritionValueEdit,
} from './nutrition-panel.models';

/**
 * Provisório (backend ainda não existe): guarda histórico, valores manuais e trilha de auditoria em
 * memória. A última confirmação prevalece (sem lock).
 */
@Injectable()
export class ProvisionalNutritionCardStore extends NutritionValueWriter implements NutritionHistorySource {
  /** Trilha de auditoria (append-only); exposta para testes e para a futura implementação real. */
  readonly auditTrail: NutritionValueEdit[] = [];
  private readonly history = new Map<string, NutritionHistoryEntry[]>();
  private readonly manual = new Map<string, NutritionManualValues>();

  load(patientId: string, indicator: NutritionIndicatorId): Promise<readonly NutritionHistoryEntry[]> {
    return Promise.resolve([...(this.history.get(this.key(patientId, indicator)) ?? [])]);
  }

  loadManual(patientId: string): Promise<NutritionManualValues> {
    return Promise.resolve({ ...this.manual.get(patientId) });
  }

  save(edit: NutritionValueEdit): Promise<void> {
    const key = this.key(edit.patientId, edit.indicator);
    const entries = this.history.get(key) ?? [];

    if (edit.previous !== null) {
      entries.unshift({
        at: edit.previous.at ?? edit.at,
        origin: edit.previous.origin,
        value: edit.previous.value,
      });
    }
    this.history.set(key, entries);
    this.manual.set(edit.patientId, {
      ...this.manual.get(edit.patientId),
      [edit.indicator]: { at: edit.at, origin: edit.newOrigin, value: edit.value },
    });
    this.auditTrail.push(edit);

    return Promise.resolve();
  }

  private key(patientId: string, indicator: NutritionIndicatorId): string {
    return `${patientId}:${indicator}`;
  }
}
