import { inject, Injectable } from '@angular/core';

import { readClaims } from '../../../shared/auth/jwt-claims';
import { AuthGateway } from '../../login/auth-gateway';
import { LocalSessionStore } from '../local-session-store';
import { SessionRevoker } from '../session-revoker';
import { AccountPasswordVerifier, PasswordCheck } from './account-password-verifier';

/**
 * Desbloqueio com a senha REAL da conta: reautentica no mesmo `POST /api/v1/auth/login`, com o e-mail do
 * token (`upn`). Em erro (senha errada, bloqueio, rede) a sessão atual não muda. Em sucesso o login emitiu
 * um novo par de tokens: adota o novo e revoga o refresh antigo (melhor esforço), sem deixar sessão órfã.
 * Não guarda a senha. PENDÊNCIA: sem rede não há como desbloquear (antes valia qualquer senha).
 */
@Injectable()
export class ApiAccountPasswordVerifier extends AccountPasswordVerifier {
  private readonly gateway = inject(AuthGateway);
  private readonly store = inject(LocalSessionStore);
  private readonly revoker = inject(SessionRevoker);

  async verify(password: string): Promise<PasswordCheck> {
    const { upn } = readClaims(this.store.accessToken());

    if (typeof upn !== 'string' || upn === '') {
      return 'unavailable';
    }

    const result = await this.gateway.login(upn, password);

    switch (result.kind) {
      case 'success': {
        const previous = this.store.refreshToken();

        this.store.updateTokens(result.tokens);
        if (previous !== null) {
          void this.revoker.revokeToken(previous).catch(() => undefined);
        }

        return 'ok';
      }
      case 'invalid-credentials':
        return 'invalid';
      case 'locked':
        return 'locked';
      // Perfil com MFA: a senha sozinha não reabre a sessão (falta o segundo fator). Decisão de produto pendente
      // (docs/regras-de-negocio/pendencias-backend-acesso.md): por ora o desbloqueio fica indisponível.
      case 'mfa-required':
      case 'network-error':
        return 'unavailable';
    }
  }
}
