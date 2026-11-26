import { inject, Injectable } from '@angular/core';

import { LocalSessionStore } from '../../features/auth/local-session-store';
import { readClaims } from './jwt-claims';
import { Role, SessionRoleReader } from './session-role';

/**
 * Perfil do usuário a partir do access token da sessão local (o backend põe o perfil em `groups`).
 * Reativo: lê o sinal do token, então muda no login, na renovação e no logout.
 */
@Injectable()
export class JwtSessionRoleReader extends SessionRoleReader {
  private readonly session = inject(LocalSessionStore);

  read(): Role | null {
    const { groups } = readClaims(this.session.accessTokenSignal());
    const list = Array.isArray(groups) ? groups : [];

    return Object.values(Role).find(role => list.includes(role)) ?? null;
  }
}
