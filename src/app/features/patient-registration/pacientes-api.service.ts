import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import {
  type CreatedPatient,
  type CreatePatientRequest,
  PatientCreationPort,
  type PatientField,
  PatientFieldError,
} from './patient-creation.port';

const FIELDS: readonly PatientField[] = ['fullName', 'birthDate', 'sex'];

/**
 * Criação de paciente via API real (`POST /api/v1/pacientes`, openapi/pacientes-api.yaml).
 * 422 (e 409 MSG-07, SAME em uso) viram `PatientFieldError` (campo + código MSG-xx + texto do servidor); 400/401/403/rede
 * chegam como o erro HTTP original e o chat mostra o erro genérico.
 */
@Injectable()
export class PacientesApiService extends PatientCreationPort {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/v1/pacientes`;

  async create(request: CreatePatientRequest): Promise<CreatedPatient> {
    try {
      return await firstValueFrom(this.http.post<CreatedPatient>(this.url, request));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 422) {
        const body = error.error as { field?: string; code?: string; message?: string } | null;
        const field = FIELDS.find(f => f === body?.field);

        if (field) {
          throw new PatientFieldError(field, body?.code ?? '', body?.message ?? '');
        }
      }
      // US-002-1-04: SAME já em uso no hospital (MSG-07, texto pronto em `message`): repete a pergunta do SAME.
      if (error instanceof HttpErrorResponse && error.status === 409) {
        const body = error.error as { code?: string; message?: string } | null;

        if (body?.code === 'MSG-07') {
          throw new PatientFieldError('medicalRecordNumber', body.code, body.message ?? '');
        }
      }
      throw error;
    }
  }
}
