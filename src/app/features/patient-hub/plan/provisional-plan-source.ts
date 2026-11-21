import { Injectable } from '@angular/core';

import {
  CurrentRoute,
  normalizeRoutes,
  RouteSaveRequest,
  SwallowingDecision,
  SwallowingSaveRequest,
} from './plan.models';
import { PlanSource } from './plan-source';
import {
  CalculatedWeights,
  NutritionTargets,
  ReferenceWeight,
  ReferenceWeightSaveRequest,
  TargetsSaveRequest,
} from './plan-targets';

/** Provisório, em memória: só o paciente `p1` começa com via vigente (permite exercitar os dois casos). */
@Injectable()
export class ProvisionalPlanSource extends PlanSource {
  private readonly store = new Map<string, CurrentRoute>([['p1', { routes: ['NE'], since: '2026-11-12T12:00:00' }]]);
  private readonly swallowing = new Map<string, SwallowingDecision>();
  private readonly referenceWeights = new Map<string, ReferenceWeight>();
  private readonly targets = new Map<string, NutritionTargets>();
  /** Pesos calculados provisórios: só o `p1` tem (a Avaliação atual guarda apenas peso atual e altura). */
  private readonly weights = new Map<string, CalculatedWeights>([
    ['p1', { adjusted: 68, current: 75, dry: 72.5, ideal: 62 }],
  ]);

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

  loadCalculatedWeights(patientId: string): Promise<CalculatedWeights> {
    return Promise.resolve(this.weights.get(patientId) ?? {});
  }

  loadReferenceWeight(patientId: string): Promise<ReferenceWeight | null> {
    return Promise.resolve(this.referenceWeights.get(patientId) ?? null);
  }

  saveReferenceWeight(request: ReferenceWeightSaveRequest): Promise<ReferenceWeight> {
    this.referenceWeights.set(request.patientId, request.weight);

    return Promise.resolve(request.weight);
  }

  loadTargets(patientId: string): Promise<NutritionTargets | null> {
    return Promise.resolve(this.targets.get(patientId) ?? null);
  }

  saveTargets(request: TargetsSaveRequest): Promise<NutritionTargets> {
    this.targets.set(request.patientId, request.targets);

    return Promise.resolve(request.targets);
  }
}
