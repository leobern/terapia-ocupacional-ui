import { Injectable } from '@angular/core';

import {
  ConductFlag,
  ConductFlagRequest,
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
  private readonly flags = new Map<string, readonly ConductFlag[]>();
  /** Trilha de auditoria: só recebe acréscimos e é devolvida como cópia congelada. */
  private readonly trail: readonly ConductFlagAudit[] = [];
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

  loadConductFlags(patientId: string): Promise<readonly ConductFlag[]> {
    return Promise.resolve(this.flags.get(patientId) ?? []);
  }

  addConductFlag(request: ConductFlagRequest): Promise<ConductFlag> {
    const previous = this.flags.get(request.patientId) ?? [];
    const flag: ConductFlag = {
      at: request.at,
      author: request.author,
      id: `${request.patientId}-${previous.length + 1}`,
      text: request.text,
    };

    this.flags.set(request.patientId, [...previous, flag]);
    (this.trail as ConductFlagAudit[]).push({
      at: request.at,
      author: request.author,
      flagId: flag.id,
      patientId: request.patientId,
    });

    return Promise.resolve(flag);
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

  /** Leitura da trilha de auditoria (autor e data/hora de cada sinalização). */
  auditTrail(): readonly Readonly<ConductFlagAudit>[] {
    return this.trail.map(entry => Object.freeze({ ...entry }));
  }
}

export interface ConductFlagAudit {
  readonly at: string;
  readonly author: string;
  readonly flagId: string;
  readonly patientId: string;
}
