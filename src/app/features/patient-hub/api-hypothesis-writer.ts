import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { isApiPatientId } from './api-patient-hub-source';
import { HypothesisOrigin, HypothesisSaveRequest } from './patient-hub.models';
import { HypothesisWriter } from './patient-hub-source';
import { ProvisionalHypothesisWriter } from './provisional-patient-hub';

const ORIGIN: Readonly<Record<HypothesisOrigin, 'AI' | 'AI_EDITED' | 'MANUAL'>> = {
  ai: 'AI',
  'ai-edited': 'AI_EDITED',
  manual: 'MANUAL',
};

/**
 * Grava a Hipótese/Diagnóstico com `PUT /api/v1/pacientes/{id}/diagnostico` (`saveDiagnosticoPaciente`). Autor e
 * data/hora são do servidor (token e relógio): o corpo leva só texto e origem. Ids de exemplo seguem no provisório.
 */
@Injectable()
export class ApiHypothesisWriter extends HypothesisWriter {
  private readonly http = inject(HttpClient);
  private readonly provisional = inject(ProvisionalHypothesisWriter);
  private readonly url = `${environment.apiBaseUrl}/v1/pacientes`;

  async save(request: HypothesisSaveRequest): Promise<void> {
    if (!isApiPatientId(request.patientId)) {
      return this.provisional.save(request);
    }
    await firstValueFrom(
      this.http.put(`${this.url}/${request.patientId}/diagnostico`, {
        origin: ORIGIN[request.origin],
        text: request.text,
      }),
    );
  }
}
