import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import {
  HospitalLink,
  HospitalLinkList,
  HospitalLinkStatus,
  HospitalOption,
  HospitalSearchPage,
} from './hospital-links.models';
import { HospitalLinksSource } from './hospital-links-source';

/** Status do contrato (`VinculoStatus`, openapi/vinculos-api.yaml). */
type VinculoStatus = 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'RECUSADO' | 'REVOGADO';

interface VinculoItem {
  readonly id: number;
  readonly hospitalId: number;
  readonly hospitalName: string;
  readonly status: VinculoStatus;
  readonly updatedAt: string;
}

interface VinculoList {
  readonly items: readonly VinculoItem[];
  readonly hasApprovedLink: boolean;
}

interface VinculoSolicitacao {
  readonly id: number;
  readonly hospital: HospitalOption;
  readonly status: VinculoStatus;
  readonly createdAt: string;
}

const STATUS_MAP: Readonly<Record<VinculoStatus, HospitalLinkStatus>> = {
  AGUARDANDO_APROVACAO: 'pending',
  APROVADO: 'approved',
  RECUSADO: 'refused',
  REVOGADO: 'revoked',
};

function toHospitalLink(item: VinculoItem): HospitalLink {
  return {
    hospitalId: item.hospitalId,
    hospitalName: item.hospitalName,
    id: item.id,
    status: STATUS_MAP[item.status] ?? 'pending',
    updatedAt: item.updatedAt,
  };
}

/**
 * Vínculos via API real (openapi/vinculos-api.yaml): `GET /api/v1/vinculos` (`listVinculos`),
 * `GET /api/v1/vinculos/hospitais` (`buscarHospitaisParaVinculo`) e
 * `POST /api/v1/vinculos/solicitacoes` (`solicitarAcessoHospital`).
 * Erros 400/401/403/404/409 e de rede chegam como `HttpErrorResponse` rejeitado e a tela mostra o aviso.
 * Status desconhecido (contrato evoluiu) é tratado como "aguardando aprovação": nunca
 * mostra acesso liberado por engano.
 */
@Injectable()
export class HospitalLinksApiService extends HospitalLinksSource {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/v1/vinculos`;

  async list(): Promise<HospitalLinkList> {
    const body = await firstValueFrom(this.http.get<VinculoList>(this.url));

    return { hasApprovedLink: body.hasApprovedLink, items: body.items.map(toHospitalLink) };
  }

  search(name: string, cursor: string | null): Promise<HospitalSearchPage> {
    let params = new HttpParams().set('nome', name);

    if (cursor !== null) {
      params = params.set('cursor', cursor);
    }

    return firstValueFrom(this.http.get<HospitalSearchPage>(`${this.url}/hospitais`, { params }));
  }

  async request(hospitalId: number): Promise<HospitalLink> {
    const created = await firstValueFrom(
      this.http.post<VinculoSolicitacao>(`${this.url}/solicitacoes`, { hospitalId }),
    );

    return {
      hospitalId: created.hospital.id,
      hospitalName: created.hospital.name,
      id: created.id,
      status: STATUS_MAP[created.status] ?? 'pending',
      updatedAt: created.createdAt,
    };
  }
}
