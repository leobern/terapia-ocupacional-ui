import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

export interface ComunicadoRecipientSpec {
  readonly type: 'PESSOA' | 'GRUPO' | 'TODOS';
  readonly professionalId?: number;
  readonly perfil?: string;
}

export interface ComunicadoProfessionalRef {
  readonly id: number;
  readonly name: string;
  readonly specialty: string;
  readonly photoUrl?: string | null;
}

export interface Comunicado {
  readonly id: number;
  readonly author: ComunicadoProfessionalRef;
  readonly content: string;
  readonly createdAt: string;
  readonly recipients: readonly ComunicadoRecipientSpec[];
  readonly resolvedRecipients?: readonly ComunicadoProfessionalRef[];
  readonly status: 'ACTIVE' | 'RESOLVED';
}

/**
 * Cliente HTTP de `POST /api/v1/comunicados` e `POST /api/v1/comunicados/destinatarios/resolver`
 * (openapi/comunicados-api.yaml). Erros 403/422 chegam como `HttpErrorResponse` com `error.message`.
 */
@Injectable({ providedIn: 'root' })
export class ComunicadosApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/comunicados`;

  /** Cria e envia o comunicado aos destinatários confirmados (trilha de auditoria é do backend). */
  create(hospitalId: number, content: string, recipients: readonly ComunicadoRecipientSpec[]): Observable<Comunicado> {
    return this.http.post<Comunicado>(this.baseUrl, { content, hospitalId, recipients });
  }

  /** Expande os destinatários em profissionais vinculados, sem criar nada. */
  resolveRecipients(
    hospitalId: number,
    recipients: readonly ComunicadoRecipientSpec[],
  ): Observable<{ professionals: readonly ComunicadoProfessionalRef[] }> {
    return this.http.post<{ professionals: readonly ComunicadoProfessionalRef[] }>(
      `${this.baseUrl}/destinatarios/resolver`,
      { hospitalId, recipients },
    );
  }
}
