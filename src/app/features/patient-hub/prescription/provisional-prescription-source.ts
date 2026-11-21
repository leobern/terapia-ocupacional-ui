import { inject, Injectable } from '@angular/core';

import { ProfessionalProfileReader } from '../../home/professional-profile';
import { ActivePrescription, PrescriptionReview, PrescriptionReviewRequest } from './prescription.models';
import { PrescriptionSource } from './prescription-source';

/** Provisório, em memória: sem prescrição ativa; a revisão fica registrada só até recarregar. */
@Injectable()
export class ProvisionalPrescriptionSource extends PrescriptionSource {
  private readonly profile = inject(ProfessionalProfileReader);
  private readonly reviews = new Map<string, PrescriptionReview>();

  loadActive(): Promise<ActivePrescription | null> {
    return Promise.resolve(null);
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
