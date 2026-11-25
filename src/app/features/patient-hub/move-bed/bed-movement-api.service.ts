import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import {
  BedMovementPort,
  BedNotIdentifiedError,
  type PatientCandidate,
  PatientNotFoundError,
  PatientWithoutInternacaoError,
  type ResolvedBedMovement,
  type ResolvedByName,
} from './bed-movement.port';

/**
 * Resolução e confirmação da movimentação de leito via API real
 * (`POST /api/v1/pacientes/{pacienteId}/internacoes/movimentacao-leito/resolver`, openapi/internacoes-api.yaml).
 * `newBedNumber` só é enviado quando preenchido. 422 MSG-11 e MSG-12 viram erros tipados; 400/401/403/404/rede
 * chegam como o erro HTTP original (erro genérico no chat).
 */
@Injectable()
export class BedMovementApiService extends BedMovementPort {
  private readonly http = inject(HttpClient);

  async resolve(pacienteId: number, newBedNumber?: string): Promise<ResolvedBedMovement> {
    const bed = newBedNumber?.trim();
    const body = bed ? { newBedNumber: bed } : {};

    try {
      return await firstValueFrom(
        this.http.post<ResolvedBedMovement>(
          `${environment.apiBaseUrl}/v1/pacientes/${pacienteId}/internacoes/movimentacao-leito/resolver`,
          body,
        ),
      );
    } catch (error) {
      throw this.translate(error);
    }
  }

  /** `POST /v1/pacientes/movimentacao-leito/resolver-por-nome`: ENCONTRADO vira `single`, MULTIPLOS vira `multiple`. */
  async resolveByName(hospitalId: number, fullName: string, newBedNumber?: string): Promise<ResolvedByName> {
    const bed = newBedNumber?.trim();
    const body = bed ? { fullName, hospitalId, newBedNumber: bed } : { fullName, hospitalId };

    try {
      const result = await firstValueFrom(
        this.http.post<{ status: string; resolvida?: ResolvedBedMovement; candidatos?: PatientCandidate[] }>(
          `${environment.apiBaseUrl}/v1/pacientes/movimentacao-leito/resolver-por-nome`,
          body,
        ),
      );

      return result.status === 'MULTIPLOS'
        ? { candidates: result.candidatos ?? [], kind: 'multiple' }
        : { kind: 'single', resolved: result.resolvida as ResolvedBedMovement };
    } catch (error) {
      throw this.translate(error);
    }
  }

  /** `POST .../internacoes/{internacaoId}/movimentacao-leito/confirmar`: só chamado após o "Sim" (RN-02). */
  async confirm(pacienteId: number, internacaoId: number, newBedNumber: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBaseUrl}/v1/pacientes/${pacienteId}/internacoes/${internacaoId}/movimentacao-leito/confirmar`,
          { newBedNumber: newBedNumber.trim() },
        ),
      );
    } catch (error) {
      throw this.translate(error);
    }
  }

  private translate(error: unknown): unknown {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      const data = error.error as { code?: string; message?: string } | null;

      if (data?.code === 'MSG-13') {
        return new PatientNotFoundError(data.message ?? '');
      }
    }
    if (error instanceof HttpErrorResponse && error.status === 422) {
      const data = error.error as { field?: string; code?: string; message?: string } | null;

      if (data?.code === 'MSG-11') {
        return new PatientWithoutInternacaoError(data.message ?? '');
      }
      if (data?.code === 'MSG-12') {
        return new BedNotIdentifiedError(data.field ?? 'newBedNumber', data.message ?? '');
      }
    }

    return error;
  }
}
