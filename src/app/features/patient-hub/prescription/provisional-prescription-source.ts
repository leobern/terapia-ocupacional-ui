import { inject, Injectable } from '@angular/core';

import { ProfessionalProfileReader } from '../../home/professional-profile';
import {
  ActivePrescription,
  Prescription,
  PrescriptionReview,
  PrescriptionReviewRequest,
  PrescriptionSaveRequest,
  toActivePrescription,
} from './prescription.models';
import { PrescriptionSource } from './prescription-source';

/** Provisório, em memória: o `p1` começa com a prescrição do exemplo do Figma; a revisão vale até recarregar. */
@Injectable()
export class ProvisionalPrescriptionSource extends PrescriptionSource {
  private readonly profile = inject(ProfessionalProfileReader);
  private readonly reviews = new Map<string, PrescriptionReview>();
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

  loadActive(patientId: string): Promise<ActivePrescription | null> {
    const prescription = this.store.get(patientId);

    return Promise.resolve(prescription === undefined ? null : toActivePrescription(prescription));
  }

  loadReview(patientId: string, day: string): Promise<PrescriptionReview | null> {
    return Promise.resolve(this.reviews.get(`${patientId}|${day}`) ?? null);
  }

  keep(request: PrescriptionReviewRequest): Promise<PrescriptionReview> {
    if (this.profile.read().role !== 'doctor') {
      return Promise.reject(new Error('Somente o médico revisa a prescrição.'));
    }
    const review: PrescriptionReview = { at: request.at, author: request.author, day: request.day };

    this.reviews.set(`${request.patientId}|${request.day}`, review);

    return Promise.resolve(review);
  }
}
