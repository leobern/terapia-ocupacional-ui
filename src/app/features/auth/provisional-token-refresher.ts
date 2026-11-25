import { Injectable } from '@angular/core';

import { RefreshRejectedError, TokenRefresher } from './token-refresher';

/**
 * Provisório: não há contrato OpenAPI da renovação de token ainda, então toda renovação é
 * recusada. Trocar por um serviço HTTP quando o backend entregar o contrato.
 */
@Injectable()
export class ProvisionalTokenRefresher extends TokenRefresher {
  refresh(): Promise<string> {
    return Promise.reject(new RefreshRejectedError());
  }
}
