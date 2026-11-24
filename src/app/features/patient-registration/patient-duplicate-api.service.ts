import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { PatientMatch } from './patient-duplicate.models';
import { PatientDuplicateError, PatientDuplicateFailure } from './patient-duplicate-error';
import { PatientDuplicateSource } from './patient-duplicate-source';

/** Schema `PatientDuplicateResult` de `openapi/pacientes-api.yaml` (`medicalRecordNumber` pode vir nulo/ausente). */
interface DuplicateResponse {
  readonly matches: readonly {
    readonly birthDate: string;
    readonly fullName: string;
    readonly medicalRecordNumber?: string | null;
  }[];
}

function classify(failure: unknown): PatientDuplicateFailure {
  const { error, status } = failure instanceof HttpErrorResponse ? failure : { error: null, status: 0 };

  switch (status) {
    case 401:
      return 'session-expired';
    case 403:
      return 'access-denied';
    case 422:
      // MSG-01 fala em "caracteres"; qualquer outro 422 é a MSG-02 (data).
      return String((error as { message?: unknown } | null)?.message ?? '').includes('caracteres')
        ? 'invalid-name'
        : 'invalid-date';
    default:
      return 'unavailable';
  }
}

/** `GET /api/v1/pacientes/duplicidade` (operação `checkPatientDuplicate`). */
@Injectable()
export class PatientDuplicateApiService extends PatientDuplicateSource {
  private readonly http = inject(HttpClient);

  async find(hospitalId: number, fullName: string, birthDate: string): Promise<readonly PatientMatch[]> {
    const params = new HttpParams()
      .set('hospitalId', hospitalId)
      .set('fullNameQuery', fullName)
      .set('birthDateQuery', birthDate);

    try {
      const { matches } = await firstValueFrom(
        this.http.get<DuplicateResponse>(`${environment.apiBaseUrl}/v1/pacientes/duplicidade`, { params }),
      );

      return matches.map(m => ({
        birthDate: m.birthDate,
        fullName: m.fullName,
        medicalRecordNumber: m.medicalRecordNumber ?? null,
      }));
    } catch (failure) {
      throw new PatientDuplicateError(classify(failure));
    }
  }
}
