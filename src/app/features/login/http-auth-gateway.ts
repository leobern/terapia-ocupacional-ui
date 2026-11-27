import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';

import { AuthGateway, LoginResult } from './auth-gateway';

/** Schema `LoginResponse` do backend; só os campos usados. */
interface LoginResponseBody {
  readonly accessToken?: string;
  readonly refreshToken?: string;
  /** Só no 202 (MFA): desafio a trocar por tokens em `/v1/auth/mfa/*` e se a pessoa ainda precisa ativar o app. */
  readonly mfaToken?: string;
  readonly setupObrigatorio?: boolean;
}

/**
 * Login via `POST /api/v1/auth/login`: 200 com tokens, 401 credenciais inválidas (mensagem genérica),
 * 423 e-mail bloqueado por 5 tentativas inválidas. Usa `fetch` (sem interceptor) para que um
 * token antigo nunca seja anexado nem renovado numa tentativa de login.
 */
@Injectable()
export class HttpAuthGateway extends AuthGateway {
  async login(email: string, password: string): Promise<LoginResult> {
    try {
      const response = await fetch(`${environment.apiBaseUrl}/v1/auth/login`, {
        body: JSON.stringify({ email, password }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (response.status === 423) {
        const retryAfter = Number(response.headers.get('Retry-After'));

        return Number.isFinite(retryAfter) && retryAfter > 0
          ? { kind: 'locked', retryAfterSeconds: retryAfter }
          : { kind: 'locked' };
      }
      if (response.status === 401 || response.status === 400) {
        return { kind: 'invalid-credentials' };
      }
      if (response.status === 202) {
        const challenge = (await response.json()) as LoginResponseBody;

        return challenge.mfaToken
          ? { challenge: challenge.mfaToken, kind: 'mfa-required', setupRequired: challenge.setupObrigatorio === true }
          : { kind: 'network-error' };
      }
      if (!response.ok) {
        return { kind: 'network-error' };
      }
      const body = (await response.json()) as LoginResponseBody;

      return body.accessToken && body.refreshToken
        ? { kind: 'success', tokens: { accessToken: body.accessToken, refreshToken: body.refreshToken } }
        : { kind: 'network-error' };
    } catch {
      return { kind: 'network-error' };
    }
  }
}
