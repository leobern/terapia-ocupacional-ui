import { Injectable } from '@angular/core';

import { DiagnosisActionRequest, DiagnosisRecord } from './diagnosis.models';
import { DiagnosisDecisionSource } from './diagnosis-decision-source';

const EMPTY: DiagnosisRecord = { audit: [], decision: null, override: null };

/** Provisório, em memória. */
@Injectable()
export class ProvisionalDiagnosisDecisionSource extends DiagnosisDecisionSource {
  private readonly store = new Map<string, DiagnosisRecord>();

  load(patientId: string): Promise<DiagnosisRecord> {
    return Promise.resolve(this.store.get(patientId) ?? EMPTY);
  }

  apply(request: DiagnosisActionRequest): Promise<DiagnosisRecord> {
    const previous = this.store.get(request.patientId) ?? EMPTY;
    const { action, altered, at, author, current } = request;
    const entry = { action, after: altered ?? null, at, author, before: altered ? current : null };
    const audit = [...previous.audit, entry];
    const next: DiagnosisRecord = altered
      ? { ...previous, audit, override: altered }
      : {
          ...previous,
          audit,
          decision: { at, author, result: current, status: action === 'confirm' ? 'confirmed' : 'excluded' },
        };

    this.store.set(request.patientId, next);

    return Promise.resolve(next);
  }
}
