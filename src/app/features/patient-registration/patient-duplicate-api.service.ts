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
    readonly id: number;
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
    case 422: {
      // O contrato indica o campo inválido em `field` (fullNameQuery = MSG-01, birthDateQuery = MSG-02).
      const body = error as { field?: unknown; message?: unknown } | null;
      const isName =
        body?.field === 'fullNameQuery' ||
        (body?.field === undefined && String(body?.message ?? '').includes('caracteres'));

      return isName ? 'invalid-name' : 'invalid-date';
    }
    default:
      return 'unavailable';
  }
}

/** `GET /api/v1/pacientes/duplicidade` (operação `checkPatientDuplicate`). */
@Injectable()
export class PatientDuplicateApiService extends PatientDuplicateSource {
  private readonly http = inject(HttpClient);

  async find(
    hospitalId: number,
    fullName: string,
    birthDate: string,
    medicalRecordNumber?: string | null,
  ): Promise<readonly PatientMatch[]> {
    let params = new HttpParams()
      .set('hospitalId', hospitalId)
      .set('fullNameQuery', fullName)
      .set('birthDateQuery', birthDate);
    const same = medicalRecordNumber?.trim();

    if (same) {
      params = params.set('medicalRecordNumberQuery', same);
    }

    try {
      const { matches } = await firstValueFrom(
        this.http.get<DuplicateResponse>(`${environment.apiBaseUrl}/v1/pacientes/duplicidade`, { params }),
      );

      return matches.map(m => ({
        birthDate: m.birthDate,
        fullName: m.fullName,
        id: m.id,
        medicalRecordNumber: m.medicalRecordNumber ?? null,
      }));
    } catch (failure) {
      throw new PatientDuplicateError(classify(failure));
    }
  }
}
