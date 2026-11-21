import { Injectable } from '@angular/core';

import { Prescription, PrescriptionSaveRequest } from './prescription.models';
import { PrescriptionSource } from './prescription-source';

/** Provisório, em memória: o `p1` começa com a prescrição do exemplo do Figma. */
@Injectable()
export class ProvisionalPrescriptionSource extends PrescriptionSource {
  private readonly store = new Map<string, Prescription>([
    [
      'p1',
      {
        at: '2026-11-20T13:33:00',
        author: 'Rafael Dutra Rabello Duarte',
        formulaId: 'enteral-1',
        formulaName: 'Fórmula polimérica 1.0',
        kcalPerMl: 1,
        modality: 'continuous',
        nursingNotes: '',
        pauseTimes: [],
        proteinPerMl: 0.04,
        startTime: '08:00',
        volumeMl: 900,
      },
    ],
  ]);

  load(patientId: string): Promise<Prescription | null> {
    return Promise.resolve(this.store.get(patientId) ?? null);
  }

  save(request: PrescriptionSaveRequest): Promise<Prescription> {
    this.store.set(request.patientId, request.prescription);

    return Promise.resolve(request.prescription);
  }
}
