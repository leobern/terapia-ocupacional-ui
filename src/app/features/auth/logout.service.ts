import { inject, Injectable } from '@angular/core';

import { LocalSessionStore } from './local-session-store';
import { SessionRevoker } from './session-revoker';

/** Encerra a sessão do dispositivo ATUAL e limpa o cache sensível local (RN02, RN03). */
@Injectable({ providedIn: 'root' })
export class LogoutService {
  private readonly revoker = inject(SessionRevoker);
  private readonly store = inject(LocalSessionStore);

  async logout(): Promise<void> {
    try {
      await this.revoker.revokeCurrentDevice();
    } catch {
      // Sem rede ou erro remoto: a sessão local termina mesmo assim.
    } finally {
      this.store.clear();
    }
  }
}
