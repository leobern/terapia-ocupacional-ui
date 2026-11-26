import { inject, Injectable } from '@angular/core';

import { OutboxService } from '../../../shared/offline/outbox.service';
import { OutboxSyncService } from '../../../shared/offline/outbox-sync.service';
import { isApiPatientId } from '../api-patient-hub-source';
import { ApiDailyEvolutionSource } from './api-daily-evolution-source';
import { originToApi } from './api-evolutions';
import { DailyEvolutionDay } from './daily-evolution-source';
import { DailyEvolution, EvolutionSaveRequest } from './daily-record.models';
import { overlayEvolution } from './offline-evolution-overlay';

/**
 * Evolução médica com escrita offline (ADR-003). Leitura: a do servidor (ou a cópia local, pelo cache HTTP) com a fila
 * pendente sobreposta; sem rede e sem cópia, o que está na fila ainda aparece. Gravação: vira operação na fila
 * (texto e, se houver, reavaliações, pelas rotas aditivas) e responde na hora com o resultado otimista, marcado
 * `pending`; o sincronizador envia sozinho. Só rejeita se o armazenamento local falhar (a tela mantém o texto). Ids de
 * exemplo seguem no provisório.
 */
@Injectable()
export class OfflineDailyEvolutionSource extends ApiDailyEvolutionSource {
  private readonly outbox = inject(OutboxService);
  private readonly sync = inject(OutboxSyncService);

  override async load(patientId: string, day: string): Promise<DailyEvolution | null> {
    if (!isApiPatientId(patientId)) {
      return super.load(patientId, day);
    }
    let base: DailyEvolution | null = null;

    try {
      base = await super.load(patientId, day);
    } catch (error) {
      if (this.outbox.forPatient(patientId, day).length === 0) {
        throw error;
      }
    }

    return overlayEvolution(base, this.outbox.forPatient(patientId, day));
  }

  override async list(patientId: string, days: readonly string[]): Promise<readonly DailyEvolutionDay[]> {
    if (!isApiPatientId(patientId)) {
      return super.list(patientId, days);
    }
    let base: readonly DailyEvolutionDay[] = [];

    try {
      base = await super.list(patientId, days);
    } catch (error) {
      if (this.outbox.forPatient(patientId).length === 0) {
        throw error;
      }
    }
    const byDay = new Map(base.map(d => [d.day, d.evolution]));

    for (const day of days) {
      const merged = overlayEvolution(byDay.get(day) ?? null, this.outbox.forPatient(patientId, day));

      if (merged !== null) {
        byDay.set(day, merged);
      }
    }

    return [...byDay.entries()]
      .map(([day, evolution]) => ({ day, evolution }))
      .sort((a, b) => b.day.localeCompare(a.day));
  }

  override async save(request: EvolutionSaveRequest): Promise<DailyEvolution> {
    if (!isApiPatientId(request.patientId)) {
      return super.save(request);
    }
    const { author, at, day, patientId } = request;

    if (request.textUnchanged !== true) {
      await this.sync.enqueue({
        baseVersion: request.baseVersion,
        day,
        occurredAt: at,
        patientId,
        payload: { author, origin: originToApi(request.origin), text: request.text },
        type: 'evolution-text',
      });
    }
    if ((request.reevaluations ?? []).length > 0) {
      await this.sync.enqueue({
        day,
        occurredAt: at,
        patientId,
        payload: { author, reevaluations: request.reevaluations },
        type: 'reevaluations',
      });
    }

    return {
      at,
      author,
      origin: request.origin,
      pending: true,
      reevaluations: request.reevaluations ?? [],
      text: request.text,
      ...(request.baseVersion === undefined ? {} : { version: request.baseVersion }),
    };
  }
}
