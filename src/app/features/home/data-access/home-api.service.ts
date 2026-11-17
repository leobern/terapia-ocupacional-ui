import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

import { HomeSummary, Hospital, NotificationPage } from '../home.models';

/**
 * Cliente HTTP para `GET /home/summary`, `GET /home/notifications` e
 * `GET /home/hospitals` (specs/003-home/contracts/home-api.yaml).
 *
 * NOTA: o plano (plan.md) previa gerar este client via `pnpm models`
 * (openapi-generator-cli, `terapia-ocupacional-ui/openapitools.json`), a
 * partir de `openapi/home-api.yaml`. O ambiente onde esta implementação foi
 * feita não tinha `pnpm`/o gerador disponíveis para rodar o comando, então
 * este serviço foi escrito à mão, com os mesmos formatos de request/response
 * do contrato. Rode `pnpm models` quando possível — se preferir manter este
 * serviço em vez do client gerado, isso também é uma escolha válida, só
 * mantenha os dois em sincronia com o YAML.
 */
@Injectable({ providedIn: 'root' })
export class HomeApiService {
  private readonly http = inject(HttpClient);
  // O backend expõe os recursos em /api/v1/... (ver HomeResource.java) —
  // environment.apiBaseUrl é só o prefixo "/api", sem a versão.
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/home`;

  getSummary(hospitalId: number): Observable<HomeSummary> {
    const params = new HttpParams().set('hospitalId', hospitalId);

    return this.http.get<HomeSummary>(`${this.baseUrl}/summary`, { params });
  }

  getNotifications(hospitalId: number, cursor: string | null, limit = 10): Observable<NotificationPage> {
    let params = new HttpParams().set('hospitalId', hospitalId).set('limit', limit);

    if (cursor) {
      params = params.set('cursor', cursor);
    }

    return this.http.get<NotificationPage>(`${this.baseUrl}/notifications`, { params });
  }

  getHospitals(): Observable<Hospital[]> {
    return this.http.get<Hospital[]>(`${this.baseUrl}/hospitals`);
  }
}
