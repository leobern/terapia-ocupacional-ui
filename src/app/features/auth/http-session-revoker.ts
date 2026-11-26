import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';

import { LocalSessionStore } from './local-session-store';
import { SessionRevoker } from './session-revoker';

/** Tempo máximo esperando o servidor: o "Sair" nunca fica preso numa rede lenta (a sessão local sai de qualquer jeito). */
export const REVOKE_TIMEOUT_MS = 5000;

/**
 * Revogação remota via `POST /api/v1/auth/logout` com o refresh token do dispositivo (idempotente, 204).
 * Usa `fetch` (sem interceptor): o endpoint é público e não deve disparar renovação. Sem refresh token
 * não há o que revogar. Falhas de rede ou HTTP rejeitam e o `LogoutService` limpa a sessão local mesmo assim.
 * O access token já emitido segue válido até expirar (no máximo 1 hora, contrato do backend).
 */
@Injectable()
export class HttpSessionRevoker extends SessionRevoker {
  private readonly store = inject(LocalSessionStore);

  async revokeCurrentDevice(): Promise<void> {
    const refreshToken = this.store.refreshToken();

    if (refreshToken !== null) {
      await this.revokeToken(refreshToken);
    }
  }

  async revokeToken(refreshToken: string): Promise<void> {
    const response = await fetch(`${environment.apiBaseUrl}/v1/auth/logout`, {
      body: JSON.stringify({ refreshToken }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`logout remoto falhou (${response.status})`);
    }
  }
}
