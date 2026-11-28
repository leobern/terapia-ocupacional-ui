import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';

import { AcceptInviteResult, InviteGateway, InvitePhoto, InviteSummary } from './invite-gateway';

/** Implementação sobre `fetch` (sem interceptor: ainda não há sessão). */
@Injectable()
export class HttpInviteGateway extends InviteGateway {
  async check(token: string): Promise<InviteSummary | null> {
    const response = await fetch(`${environment.apiBaseUrl}/v1/auth/convites/${encodeURIComponent(token)}`);

    if ([400, 404, 410].includes(response.status)) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = (await response.json()) as { email: string; papel: string; hospitais?: string[] };

    return { email: body.email, hospitals: body.hospitais ?? [], role: body.papel };
  }

  async accept(token: string, fullName: string, password: string, photo?: InvitePhoto): Promise<AcceptInviteResult> {
    const response = await fetch(`${environment.apiBaseUrl}/v1/auth/convites/aceitar`, {
      body: JSON.stringify({
        fotoBase64: photo?.base64,
        fotoTipo: photo?.type,
        nomeCompleto: fullName,
        senha: password,
        token,
      }),
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
