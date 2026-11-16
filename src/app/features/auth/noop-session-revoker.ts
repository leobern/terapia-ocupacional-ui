import { Injectable } from '@angular/core';

import { SessionRevoker } from './session-revoker';

/** Implementação provisória: não há sessão remota até US-001-1-08. */
@Injectable()
export class NoopSessionRevoker extends SessionRevoker {
  revokeCurrentDevice(): Promise<void> {
    return Promise.resolve();
  }
}
