import { Injectable } from '@angular/core';

import { AuthGateway, LoginResult } from './auth-gateway';

/** Implementação provisória: sem backend, toda tentativa é uma falha de rede. */
@Injectable()
export class ProvisionalAuthGateway extends AuthGateway {
  login(): Promise<LoginResult> {
    return Promise.resolve({ kind: 'network-error' });
  }
}
