import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';

import { AcceptInviteResult, InviteGateway } from './invite-gateway';

/** Implementação sobre `fetch` (sem interceptor: ainda não há sessão). Caminho proposto, a confirmar com o backend. */
@Injectable()
export class HttpInviteGateway extends InviteGateway {
  async accept(token: string, fullName: string, password: string): Promise<AcceptInviteResult> {
    const response = await fetch(`${environment.apiBaseUrl}/v1/auth/convites/aceitar`, {
      body: JSON.stringify({ nomeCompleto: fullName, senha: password, token }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    if ([400, 404, 410].includes(response.status)) {
      return 'invalid-token';
    }
    if (response.status === 409) {
      return 'already-registered';
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return 'ok';
  }
}
