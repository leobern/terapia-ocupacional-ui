import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';

import { SessionTokens } from './local-session-store';
import { RefreshRejectedError, TokenRefresher } from './token-refresher';

/** Schema `LoginResponse` do backend; só os campos usados. */
interface RenewalResponseBody {
  readonly accessToken?: string;
  readonly refreshToken?: string;
}

/**
 * Renovação via `POST /api/v1/auth/token/renovar`: 200 devolve novo access token e novo refresh
 * token (a sessão ativa não expira em 24 h); 401 e 400 recusam o refresh token (definitivo). Qualquer
 * outra resposta ou falha de rede é erro transitório e não encerra a sessão (RN-06). Usa `fetch`
 * (sem interceptor) para a renovação nunca disparar outra renovação.
 */
@Injectable()
export class HttpTokenRefresher extends TokenRefresher {
  async refresh(refreshToken: string): Promise<SessionTokens> {
    const response = await fetch(`${environment.apiBaseUrl}/v1/auth/token/renovar`, {
      body: JSON.stringify({ refreshToken }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    if (response.status === 401 || response.status === 400) {
      throw new RefreshRejectedError();
    }
    if (!response.ok) {
      throw new Error(`renovação falhou (${response.status})`);
    }

    const body = (await response.json()) as RenewalResponseBody;

    if (!body.accessToken || !body.refreshToken) {
      throw new Error('resposta de renovação incompleta');
    }

    return { accessToken: body.accessToken, refreshToken: body.refreshToken };
  }
}
