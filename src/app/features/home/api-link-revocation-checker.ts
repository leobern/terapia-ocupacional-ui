import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { LinkRevocationChecker } from './link-revocation-checker';

/** Schemas `VinculoList`/`VinculoItem` de `openapi/vinculos-api.yaml`; só os campos usados. */
interface VinculoListResponse {
  readonly items: readonly { readonly hospitalId: number; readonly status: string }[];
}

/** Confere o status do vínculo em `GET /api/v1/vinculos`. */
@Injectable()
export class ApiLinkRevocationChecker extends LinkRevocationChecker {
  private readonly http = inject(HttpClient);

  async isRevoked(hospitalId: number): Promise<boolean> {
    try {
      const { items } = await firstValueFrom(
        this.http.get<VinculoListResponse>(`${environment.apiBaseUrl}/v1/vinculos`),
      );

      return items.some(item => item.hospitalId === hospitalId && item.status === 'REVOGADO');
    } catch {
      return false;
    }
  }
}
