import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { LocalSessionStore } from '../auth/local-session-store';
import { InactivityLockService } from '../auth/lock/inactivity-lock.service';
import { LocalStartupState, StartupStateReader } from './startup-state';

/** Chave do cache local do último `hasApprovedLink` conhecido (apagada no logout, fora da allowlist). */
export const APPROVED_LINK_CACHE_KEY = 'startup.hasApprovedLink';

/** Schema `VinculoList` de `GET /api/v1/vinculos` (`openapi/vinculos-api.yaml`); só o campo usado. */
interface VinculoListResponse {
  readonly hasApprovedLink: boolean;
}

/**
 * Estado de abertura: a sessão vem de `LocalSessionStore`, o bloqueio de `InactivityLockService` e o
 * vínculo aprovado de `GET /api/v1/vinculos`. O último valor conhecido fica em cache local;
 * qualquer falha (rede, 401, 403) mantém esse valor e nunca quebra a splash.
 */
@Injectable()
export class LocalStartupStateReader extends StartupStateReader {
  private readonly store = inject(LocalSessionStore);
  private readonly lock = inject(InactivityLockService);
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/v1/vinculos`;

  readLocal(): LocalStartupState {
    return {
      hasApprovedHospitalLink: this.cached(),
      isLocked: this.lock.evaluate() === 'LOCKED',
      isSessionValid: this.store.isValid(),
    };
  }

  async initialize(): Promise<void> {
    try {
      const { hasApprovedLink } = await firstValueFrom(this.http.get<VinculoListResponse>(this.url));

      this.save(hasApprovedLink === true);
    } catch {
      // Offline ou sem permissão: segue com o último valor conhecido.
    }
  }

  private cached(): boolean {
    try {
      return localStorage.getItem(APPROVED_LINK_CACHE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private save(value: boolean): void {
    try {
      localStorage.setItem(APPROVED_LINK_CACHE_KEY, String(value));
    } catch {
      // Armazenamento indisponível: o valor só vale nesta abertura.
    }
  }
}
