import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import {
  type CreatedInternacao,
  type CreateInternacaoRequest,
  InternacaoCreationPort,
  InternacaoFieldError,
} from './internacao-creation.port';

/**
 * Criação de internação via API real (`POST /api/v1/pacientes/{pacienteId}/internacoes`, openapi/internacoes-api.yaml).
 * Só os campos preenchidos são enviados (corpo `{}` quando nenhum, RN-01). 422 com `hospitalAdmissionDate` (MSG-08) ou `locations` (MSG-09/10)
 * vira `InternacaoFieldError`; 400/401/403/404/rede chegam como o erro HTTP original (erro genérico no chat).
 */
@Injectable()
export class InternacoesApiService extends InternacaoCreationPort {
  private readonly http = inject(HttpClient);

  async create(pacienteId: number, request: CreateInternacaoRequest): Promise<CreatedInternacao> {
    const body = Object.fromEntries(
      Object.entries(request).filter(([, value]) => (Array.isArray(value) ? value.length > 0 : value)),
    );

    try {
      return await firstValueFrom(
        this.http.post<CreatedInternacao>(`${environment.apiBaseUrl}/v1/pacientes/${pacienteId}/internacoes`, body),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 422) {
        const data = error.error as { field?: string; code?: string; message?: string } | null;

        if (data?.field === 'hospitalAdmissionDate' || data?.field === 'locations') {
          throw new InternacaoFieldError(data.field, data.code ?? '', data.message ?? '');
        }
      }
      throw error;
    }
  }
}
