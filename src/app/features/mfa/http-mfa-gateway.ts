import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';

import { MfaGateway, MfaResult, MfaSetup } from './mfa-gateway';

interface TokensBody {
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly codigosRecuperacao?: readonly string[];
}

/** Implementação sobre `fetch` (sem interceptor: o desafio ainda não é sessão). Caminhos propostos, a confirmar. */
@Injectable()
export class HttpMfaGateway extends MfaGateway {
  verify(challenge: string, code: string): Promise<MfaResult> {
    return this.exchange('/v1/auth/mfa/verificar', { codigo: code, mfaToken: challenge });
  }

  recover(challenge: string, recoveryCode: string): Promise<MfaResult> {
    return this.exchange('/v1/auth/mfa/recuperar', { codigoRecuperacao: recoveryCode, mfaToken: challenge });
  }

  async beginSetup(challenge: string): Promise<MfaSetup | null> {
    try {
      const response = await this.post('/v1/auth/mfa/configurar', { mfaToken: challenge });

      if (!response.ok) {
        return null;
      }
      const body = (await response.json()) as { otpauthUri?: string; segredo?: string };

      return body.segredo && body.otpauthUri ? { otpauthUri: body.otpauthUri, secret: body.segredo } : null;
    } catch {
      return null;
    }
  }

  confirmSetup(challenge: string, code: string): Promise<MfaResult> {
    return this.exchange('/v1/auth/mfa/confirmar', { codigo: code, mfaToken: challenge });
  }

  private async exchange(path: string, body: unknown): Promise<MfaResult> {
    try {
      const response = await this.post(path, body);

      if (response.status === 423) {
        return { kind: 'locked' };
      }
      if (response.status === 410) {
        return { kind: 'expired' };
      }
      if (response.status === 401 || response.status === 400) {
        return { kind: 'invalid-code' };
      }
      if (!response.ok) {
        return { kind: 'network-error' };
      }
      const data = (await response.json()) as TokensBody;

      return data.accessToken && data.refreshToken
        ? {
            kind: 'success',
            recoveryCodes: data.codigosRecuperacao,
            tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
          }
        : { kind: 'network-error' };
    } catch {
      return { kind: 'network-error' };
    }
  }

  private post(path: string, body: unknown): Promise<Response> {
    return fetch(`${environment.apiBaseUrl}${path}`, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  }
}
