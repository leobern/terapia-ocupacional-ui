import { inject, Injectable } from '@angular/core';

import { LocalSessionStore } from '../../features/auth/local-session-store';
import { readClaims } from '../auth/jwt-claims';

/**
 * Identifica o usuário da sessão para separar cache e fila por pessoa (ADR-003). Usa a claim `upn` (e-mail do
 * profissional, a mesma do desbloqueio) e, na falta dela, `sub`. Sem sessão ou sem claim estável devolve `null`: nesse
 * caso o modo offline fica desligado (nada é guardado nem enviado).
 */
@Injectable({ providedIn: 'root' })
export class OfflineUserService {
  private readonly session = inject(LocalSessionStore);

  userId(): string | null {
    const { sub, upn } = readClaims(this.session.accessToken());
    const id = [upn, sub].find(v => typeof v === 'string' && v.trim() !== '');

    return typeof id === 'string' ? id.trim().toLowerCase() : null;
  }
}
