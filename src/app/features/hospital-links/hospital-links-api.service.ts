import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { HospitalLink, HospitalLinkList, HospitalLinkStatus } from './hospital-links.models';
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
 * Vínculos via API real: `GET /api/v1/vinculos` (`listVinculos`, openapi/vinculos-api.yaml).
 * Erros 401/403 e de rede chegam como `HttpErrorResponse` rejeitado e a tela mostra o erro.
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
}
