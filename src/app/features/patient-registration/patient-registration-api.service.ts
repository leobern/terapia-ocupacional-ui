import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import {
  NewPatient,
  PatientRegistrationPort,
  PatientRegistrationResult,
  RegisteredPatient,
} from './patient-registration-port';

/** Schema `SameDuplicadoError` do contrato (`openapi/pacientes-api.yaml`). */
interface SameDuplicadoError {
  readonly code?: string;
  readonly medicalRecordNumber?: string;
  readonly existingPatientName?: string;
}

function isSameDuplicate(error: unknown): error is HttpErrorResponse & { error: Required<SameDuplicadoError> } {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
    return false;
  }
  const body = error.error as SameDuplicadoError | null;

  return (
    body?.code === 'MSG-07' &&
    typeof body.medicalRecordNumber === 'string' &&
    typeof body.existingPatientName === 'string'
  );
}

/**
 * Cadastro de paciente via API real: `POST /api/v1/pacientes (hospitalId no corpo)`
 * (`openapi/pacientes-api.yaml`). O 409 `MSG-07` vira resultado tipado; os demais
 * erros chegam como `HttpErrorResponse` rejeitado, como no resto do app.
 */
@Injectable()
export class PatientRegistrationApiService extends PatientRegistrationPort {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/v1/pacientes`;

  async create(hospitalId: number, patient: NewPatient): Promise<PatientRegistrationResult> {
    try {
      const created = await firstValueFrom(this.http.post<RegisteredPatient>(this.url, { ...patient, hospitalId }));

      return { kind: 'created', patient: created };
    } catch (error) {
      if (isSameDuplicate(error)) {
        const { existingPatientName, medicalRecordNumber } = error.error;

        return { existingPatientName, kind: 'same-duplicate', medicalRecordNumber };
      }
      throw error;
    }
  }
}
