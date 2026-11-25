import { inject, Injectable } from '@angular/core';

import { LocalSessionStore } from '../../features/auth/local-session-store';
import { Role, SessionRoleReader } from './session-role';

/** Lê o claim `groups` do JWT. Falha fechada: token ausente, malformado ou desconhecido vira `null`. */
function groupsOf(token: string | null): readonly unknown[] {
  try {
    const payload = token?.split('.')[1];

    if (!payload) {
      return [];
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as { groups?: unknown };

    return Array.isArray(claims.groups) ? claims.groups : [];
  } catch {
    return [];
  }
}

/**
 * Perfil do usuário a partir do access token da sessão local (o backend põe o perfil em `groups`).
 * Reativo: lê o sinal do token, então muda no login, na renovação e no logout.
 */
@Injectable()
export class JwtSessionRoleReader extends SessionRoleReader {
  private readonly session = inject(LocalSessionStore);

  read(): Role | null {
    const groups = groupsOf(this.session.accessTokenSignal());

    return Object.values(Role).find(role => groups.includes(role)) ?? null;
  }
}
