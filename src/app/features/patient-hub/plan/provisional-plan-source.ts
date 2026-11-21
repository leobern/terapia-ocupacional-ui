import { Injectable } from '@angular/core';

import {
  CurrentRoute,
  normalizeRoutes,
  RouteSaveRequest,
  SwallowingDecision,
  SwallowingSaveRequest,
} from './plan.models';
import { PlanSource } from './plan-source';

/** Provisório, em memória: só o paciente `p1` começa com via vigente (permite exercitar os dois casos). */
@Injectable()
export class ProvisionalPlanSource extends PlanSource {
  private readonly store = new Map<string, CurrentRoute>([['p1', { routes: ['NE'], since: '2026-11-12T12:00:00' }]]);
  private readonly swallowing = new Map<string, SwallowingDecision>();

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
}
