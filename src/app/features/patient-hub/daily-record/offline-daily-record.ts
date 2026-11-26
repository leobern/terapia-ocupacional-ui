import { inject, Injectable } from '@angular/core';

import { OutboxService } from '../../../shared/offline/outbox.service';
import { OutboxSyncService } from '../../../shared/offline/outbox-sync.service';
import { isApiPatientId } from '../api-patient-hub-source';
import { ApiDailyRecordSource } from './api-daily-record-source';
import { toParametroDto } from './api-evolutions';
import { dayKey, NewParameterEntry, ParameterEntry } from './daily-record.models';
import { DailyRecordWriter } from './daily-record-writer';
import { pendingEntries } from './offline-evolution-overlay';
import { ProvisionalDailyRecordSource } from './provisional-daily-record-source';

/**
 * Leitura dos lançamentos do Registro diário com a fila pendente sobreposta (ADR-003): sem rede e sem cópia local, o
 * que está na fila ainda aparece; com os dois, os pendentes vêm depois dos já gravados.
 */
@Injectable()
export class OfflineDailyRecordSource extends ApiDailyRecordSource {
  private readonly outbox = inject(OutboxService);

  override async loadEntries(patientId: string): Promise<readonly ParameterEntry[]> {
    if (!isApiPatientId(patientId)) {
      return super.loadEntries(patientId);
    }
    const pending = pendingEntries(this.outbox.forPatient(patientId));
    let base: readonly ParameterEntry[] = [];

    try {
      base = await super.loadEntries(patientId);
    } catch (error) {
      if (pending.length === 0) {
        throw error;
      }
    }

    return [...base, ...pending];
  }
}

/**
 * Grava parâmetros do Registro diário pela fila (rota aditiva `/parametros`, ADR-003): cada gravação é uma entrada
 * nova e imutável, sem ler nem regravar o dia. Responde na hora com os lançamentos otimistas; só rejeita se o
 * armazenamento local falhar. Ids de exemplo seguem no provisório.
 */
@Injectable()
export class OfflineDailyRecordWriter extends DailyRecordWriter {
  private readonly sync = inject(OutboxSyncService);
  private readonly provisional = inject(ProvisionalDailyRecordSource);

  async record(patientId: string, entries: readonly NewParameterEntry[]): Promise<readonly ParameterEntry[]> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.record(patientId, entries);
    }
    if (entries.length === 0) {
      return [];
    }
    const { at, author } = entries[0];
    const operation = await this.sync.enqueue({
      day: dayKey(new Date(at)),
      occurredAt: at,
      patientId,
      payload: { author, parameters: entries.map(toParametroDto) },
      type: 'parameters',
    });

    return entries.map((entry, index) => ({ ...entry, id: `pendente:${operation.opId}#${index}` }));
  }
}
