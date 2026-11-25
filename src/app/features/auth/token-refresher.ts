/** Falha DEFINITIVA de renovação: o `refreshToken` é inválido, expirado ou foi revogado (C6). */
export class RefreshRejectedError extends Error {
  constructor() {
    super('refresh token rejected');
    this.name = 'RefreshRejectedError';
  }
}

import type { SessionTokens } from './local-session-store';

/**
 * Porta da renovação do `accessToken` via `refreshToken` (RN-05). Resolve com os novos tokens
 * (o backend rotaciona o refresh token); rejeita com `RefreshRejectedError` quando o servidor recusa o token e com
 * qualquer outro erro quando é falha de rede (a sessão NÃO é encerrada, RN-06).
 */
export abstract class TokenRefresher {
  abstract refresh(refreshToken: string): Promise<SessionTokens>;
}
