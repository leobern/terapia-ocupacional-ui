import { Injectable } from '@angular/core';

import { DailyEvolutionSource } from './daily-evolution-source';
import { DailyEvolution, EvolutionSaveRequest } from './daily-record.models';

/** Provisório, em memória: sem evolução registrada ao iniciar. */
@Injectable()
export class ProvisionalDailyEvolutionSource extends DailyEvolutionSource {
  private readonly store = new Map<string, DailyEvolution>();

  load(patientId: string, day: string): Promise<DailyEvolution | null> {
    return Promise.resolve(this.store.get(`${patientId}|${day}`) ?? null);
  }

  save(request: EvolutionSaveRequest): Promise<DailyEvolution> {
    const saved: DailyEvolution = {
      author: request.author,
      at: request.at,
      origin: request.origin,
      reevaluations: request.reevaluations ?? [],
      text: request.text,
    };

    this.store.set(`${request.patientId}|${request.day}`, saved);

    return Promise.resolve(saved);
  }
}
