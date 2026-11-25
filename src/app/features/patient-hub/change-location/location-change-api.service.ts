import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { PatientWithoutInternacaoError } from '../move-bed/bed-movement.port';
import {
  LocationChangePort,
  LocationNotIdentifiedError,
  type LocationType,
  type ResolvedLocationChange,
} from './location-change.port';

/**
 * Prévia e confirmação da alteração de unidade/ala via API real
 * (`.../internacoes/localizacao/resolver` e `.../internacoes/{internacaoId}/localizacao/confirmar`,
 * openapi/internacoes-api.yaml). 422 MSG-11/09/10 viram erros tipados; os demais chegam como o erro HTTP original.
 */
@Injectable()
export class LocationChangeApiService extends LocationChangePort {
  private readonly http = inject(HttpClient);

  async resolve(pacienteId: number, type: LocationType, value: string): Promise<ResolvedLocationChange> {
    try {
      return await firstValueFrom(
        this.http.post<ResolvedLocationChange>(
          `${environment.apiBaseUrl}/v1/pacientes/${pacienteId}/internacoes/localizacao/resolver`,
          this.body(type, value),
        ),
      );
    } catch (error) {
      throw this.translate(error);
    }
  }

  async confirm(pacienteId: number, internacaoId: number, type: LocationType, value: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBaseUrl}/v1/pacientes/${pacienteId}/internacoes/${internacaoId}/localizacao/confirmar`,
          this.body(type, value),
        ),
      );
    } catch (error) {
      throw this.translate(error);
    }
  }

  private body(type: LocationType, value: string): { locationType: LocationType; locationValue: string } {
    return { locationType: type, locationValue: value.trim() };
  }

  private translate(error: unknown): unknown {
    if (error instanceof HttpErrorResponse && error.status === 422) {
      const data = error.error as { field?: string; code?: string; message?: string } | null;

      if (data?.code === 'MSG-11') {
        return new PatientWithoutInternacaoError(data.message ?? '');
      }
      if (data?.code === 'MSG-09' || data?.code === 'MSG-10') {
        return new LocationNotIdentifiedError(data.field ?? '', data.code, data.message ?? '');
      }
    }

    return error;
  }
}
