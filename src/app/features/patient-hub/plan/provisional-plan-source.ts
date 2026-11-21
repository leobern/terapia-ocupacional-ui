import { Injectable } from '@angular/core';

import {
  CurrentRoute,
  normalizeRoutes,
  RouteSaveRequest,
  SwallowingDecision,
  SwallowingSaveRequest,
} from './plan.models';
import { PlanSource } from './plan-source';
import { CadenceSaveRequest, normalizeCadence, ReviewCadence } from './review-cadence';

/** Provisório, em memória: só o paciente `p1` começa com via vigente (permite exercitar os dois casos). */
@Injectable()
export class ProvisionalPlanSource extends PlanSource {
  private readonly store = new Map<string, CurrentRoute>([['p1', { routes: ['NE'], since: '2026-11-12T12:00:00' }]]);
  private readonly swallowing = new Map<string, SwallowingDecision>();
  private readonly cadence = new Map<string, ReviewCadence>();

  loadRoute(patientId: string): Promise<CurrentRoute | null> {
    return Promise.resolve(this.store.get(patientId) ?? null);
  }

  saveRoute(request: RouteSaveRequest): Promise<CurrentRoute> {
    const saved: CurrentRoute = { routes: normalizeRoutes(request.routes), since: request.at };

    this.store.set(request.patientId, saved);

    return Promise.resolve(saved);
  }

  loadSwallowing(patientId: string): Promise<SwallowingDecision | null> {
    return Promise.resolve(this.swallowing.get(patientId) ?? null);
  }

  saveSwallowing(request: SwallowingSaveRequest): Promise<SwallowingDecision> {
    this.swallowing.set(request.patientId, request.decision);

    return Promise.resolve(request.decision);
  }

  loadCadence(patientId: string): Promise<ReviewCadence | null> {
    return Promise.resolve(this.cadence.get(patientId) ?? null);
  }

  saveCadence(request: CadenceSaveRequest): Promise<ReviewCadence> {
    const saved = normalizeCadence(request.days);

    this.cadence.set(request.patientId, saved);

    return Promise.resolve(saved);
  }
}
