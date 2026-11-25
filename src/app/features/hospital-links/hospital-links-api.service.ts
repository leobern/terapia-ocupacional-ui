import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { HospitalLink, HospitalOption, HospitalSearchPage, LinkStatus } from './hospital-links.models';
import { HospitalLinksPort } from './hospital-links-port';

interface VinculoItemDto {
  readonly id: number;
  readonly hospitalId: number;
  readonly hospitalName: string;
  readonly status: LinkStatus;
}

interface VinculoSolicitacaoDto {
  readonly id: number;
  readonly hospital: HospitalOption;
  readonly status: LinkStatus;
}

/** Vínculos contra a API real (openapi/vinculos-api.yaml). 400/401/403/404/409 chegam como `HttpErrorResponse`. */
@Injectable()
export class HospitalLinksApiService extends HospitalLinksPort {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/v1/vinculos`;

  search(name: string, cursor: string | null): Promise<HospitalSearchPage> {
    let params = new HttpParams().set('nome', name);

    if (cursor !== null) {
      params = params.set('cursor', cursor);
    }

    return firstValueFrom(this.http.get<HospitalSearchPage>(`${this.base}/hospitais`, { params }));
  }

  async list(): Promise<readonly HospitalLink[]> {
    const body = await firstValueFrom(this.http.get<{ items: VinculoItemDto[] }>(this.base));

    return body.items.map(({ id, hospitalId, hospitalName, status }) => ({ id, hospitalId, hospitalName, status }));
  }

  async request(hospitalId: number): Promise<HospitalLink> {
    const created = await firstValueFrom(
      this.http.post<VinculoSolicitacaoDto>(`${this.base}/solicitacoes`, { hospitalId }),
    );

    return {
      hospitalId: created.hospital.id,
      hospitalName: created.hospital.name,
      id: created.id,
      status: created.status,
    };
  }
}
