import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';
import { ConfirmResetResult, PasswordResetGateway, RequestResetResult } from './password-reset-gateway';

/**
 * Implementação sobre `fetch`. Os caminhos abaixo são premissa desta story (o contrato
 * do backend ainda não está especificado) e devem ser confirmados com o time de backend.
 */
@Injectable()
export class HttpPasswordResetGateway extends PasswordResetGateway {
  async requestReset(email: string): Promise<RequestResetResult> {
    const response = await this.post('/auth/password-reset/request', { email });

    if (response.status === 404) {
      return 'unknown-email';
    }
    this.assertOk(response);

    return 'sent';
  }

  async confirmReset(token: string, newPassword: string): Promise<ConfirmResetResult> {
    const response = await this.post('/auth/password-reset/confirm', { token, newPassword });

    if ([400, 404, 410].includes(response.status)) {
      return 'invalid-token';
    }
    this.assertOk(response);

    return 'ok';
  }

  private post(path: string, body: unknown): Promise<Response> {
    return fetch(`${environment.apiBaseUrl}${path}`, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  }

  private assertOk(response: Response): void {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }
}
