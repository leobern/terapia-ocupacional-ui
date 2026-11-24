import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

/** Corpo de `POST /api/v1/pacientes/duplicidade` (openapi/pacientes-api.yaml). */
export interface PatientDuplicateCheckRequest {
  readonly hospitalId: number;
  readonly fullName: string;
  /** Formato `yyyy-MM-dd`. */
  readonly birthDate: string;
  readonly medicalRecordNumber?: string | null;
}

export interface PatientDuplicateCandidate {
  readonly id: number;
  readonly fullName: string;
  readonly birthDate: string;
  /** SAME do paciente já cadastrado; nulo se não preenchido. */
  readonly medicalRecordNumber?: string | null;
}

export interface PatientDuplicateCheckResult {
  readonly duplicate: boolean;
  readonly candidates: readonly PatientDuplicateCandidate[];
}

/** Cliente HTTP do contrato `openapi/pacientes-api.yaml` (US-002-1-03). */
@Injectable({ providedIn: 'root' })
export class PatientsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/pacientes`;

  checkDuplicate(request: PatientDuplicateCheckRequest): Observable<PatientDuplicateCheckResult> {
    return this.http.post<PatientDuplicateCheckResult>(`${this.baseUrl}/duplicidade`, request);
  }
}
