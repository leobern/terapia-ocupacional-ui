import { Injectable } from '@angular/core';

import { RefeedingRisk, RefeedingRiskSource } from './refeeding-risk-source';

/** Provisório: `p1` com risco em progressão, `p2` com meta atingida; os demais sem risco. */
@Injectable()
export class ProvisionalRefeedingRiskSource extends RefeedingRiskSource {
  load(patientId: string): Promise<RefeedingRisk> {
    return Promise.resolve({
      atRisk: patientId === 'p1' || patientId === 'p2',
      targetReached: patientId === 'p2',
    });
  }
}
