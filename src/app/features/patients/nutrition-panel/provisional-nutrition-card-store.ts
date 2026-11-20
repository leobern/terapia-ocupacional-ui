import { Injectable } from '@angular/core';

import {
  NutritionAddedCards,
  NutritionHiddenCards,
  NutritionHistorySource,
  NutritionValueWriter,
} from './nutrition-card-ports';
import {
  CatalogNutritionIndicatorId,
  NutritionHistoryDeletion,
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
export class ProvisionalNutritionCardStore
  extends NutritionValueWriter
  implements NutritionHistorySource, NutritionAddedCards, NutritionHiddenCards
{
  /** Trilha de auditoria (append-only); exposta para testes e para a futura implementação real. */
  readonly auditTrail: NutritionValueEdit[] = [];
  /** Trilha de auditoria das exclusões de entradas do histórico (append-only). */
  readonly deletionAuditTrail: NutritionHistoryDeletion[] = [];
  private readonly hidden = new Map<string, NutritionIndicatorId[]>();
  private readonly added = new Map<string, CatalogNutritionIndicatorId[]>();
  private nextId = 1;
  private readonly history = new Map<string, NutritionHistoryEntry[]>();
  private readonly manual = new Map<string, NutritionManualValues>();

  loadAdded(patientId: string): Promise<readonly CatalogNutritionIndicatorId[]> {
    return Promise.resolve([...(this.added.get(patientId) ?? [])]);
  }

  loadHidden(patientId: string): Promise<readonly NutritionIndicatorId[]> {
    return Promise.resolve([...(this.hidden.get(patientId) ?? [])]);
  }

  setHidden(patientId: string, indicator: NutritionIndicatorId, hidden: boolean): Promise<void> {
    const rest = (this.hidden.get(patientId) ?? []).filter(i => i !== indicator);

    // Só a visibilidade muda: valor atual e histórico ficam intactos.
    this.hidden.set(patientId, hidden ? [...rest, indicator] : rest);

    return Promise.resolve();
  }

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
        id: `h${this.nextId++}`,
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

  add(patientId: string, type: CatalogNutritionIndicatorId): Promise<void> {
    const list = this.added.get(patientId) ?? [];

    if (!list.includes(type)) {
      this.added.set(patientId, [...list, type]);
    }

    return Promise.resolve();
  }

  deleteEntry(deletion: NutritionHistoryDeletion): Promise<void> {
    const key = this.key(deletion.patientId, deletion.indicator);

    // Só a visualização perde a entrada; a auditoria acumula (inclusive a própria exclusão).
    this.history.set(
      key,
      (this.history.get(key) ?? []).filter(e => e.id !== deletion.entry.id),
    );
    this.deletionAuditTrail.push(deletion);

    return Promise.resolve();
  }

  private key(patientId: string, indicator: NutritionIndicatorId): string {
    return `${patientId}:${indicator}`;
  }
}
