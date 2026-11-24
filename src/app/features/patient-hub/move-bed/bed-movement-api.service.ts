import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { BedMovementPort, type ResolvedBedMovement, translateMovementError } from './bed-movement.port';

/**
 * Resolução da movimentação de leito via API real
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
      throw translateMovementError(error);
    }
  }
}
