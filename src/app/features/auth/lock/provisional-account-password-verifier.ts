import { Injectable } from '@angular/core';

import { AccountPasswordVerifier } from './account-password-verifier';

/**
 * Provisório: a API de login ainda não existe, então não há como conferir a senha real.
 * Aceita qualquer senha não vazia; trocar pela validação do login (US-001-1-03).
 */
@Injectable()
export class ProvisionalAccountPasswordVerifier extends AccountPasswordVerifier {
  verify(password: string): Promise<boolean> {
    return Promise.resolve(password.length > 0);
  }
}
