import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { ProfessionalAccessRevoker } from './professional-access-port';

/** Resposta 200 de `POST /api/v1/hospitais/{hospitalId}/profissionais/{usuarioId}/revogacao` (VinculoRevogado). */
export interface RevokedLink {
  readonly vinculoId: number;
  readonly hospitalId: number;
  readonly usuarioId: number;
  readonly status: 'REVOGADO';
  readonly updatedAt: string;
}

/**
 * Revogação contra a API real (openapi/vinculos-api.yaml). 401/403/404/409 chegam como
 * `HttpErrorResponse` rejeitado; a tela mapeia `status` para a mensagem.
 */
@Injectable()
export class ProfessionalAccessApiService extends ProfessionalAccessRevoker {
  private readonly http = inject(HttpClient);

  async revoke(hospitalId: number, professionalId: number): Promise<void> {
    if (!Number.isInteger(hospitalId) || !Number.isInteger(professionalId)) {
      throw new Error(`Identificador inválido para a API: ${hospitalId}/${professionalId}`);
    }
    await firstValueFrom(
      this.http.post<RevokedLink>(
        `${environment.apiBaseUrl}/v1/hospitais/${hospitalId}/profissionais/${professionalId}/revogacao`,
        {},
      ),
    );
  }
}
