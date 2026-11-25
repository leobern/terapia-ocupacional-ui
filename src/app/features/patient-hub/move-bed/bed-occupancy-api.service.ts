import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { type BedOccupancy, BedOccupancyPort, translateMovementError } from './bed-movement.port';

/**
 * Consulta de ocupação do leito via API real
 * (`GET /api/v1/pacientes/{pacienteId}/internacoes/movimentacao-leito/ocupacao?newBedNumber=`, openapi/internacoes-api.yaml).
 * 422 MSG-11 e MSG-12 viram erros tipados; os demais erros chegam como o erro HTTP original.
 */
@Injectable()
export class BedOccupancyApiService extends BedOccupancyPort {
  private readonly http = inject(HttpClient);

  async check(pacienteId: number, newBedNumber: string): Promise<BedOccupancy> {
    try {
      return await firstValueFrom(
        this.http.get<BedOccupancy>(
          `${environment.apiBaseUrl}/v1/pacientes/${pacienteId}/internacoes/movimentacao-leito/ocupacao`,
          { params: { newBedNumber: newBedNumber.trim() } },
        ),
      );
    } catch (error) {
      throw translateMovementError(error);
    }
  }
}
