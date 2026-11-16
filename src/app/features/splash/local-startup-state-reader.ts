import { inject, Injectable } from '@angular/core';

import { LocalSessionStore } from '../auth/local-session-store';
import { LocalStartupState, StartupStateReader } from './startup-state';

/** Implementação provisória: a sessão vem de `LocalSessionStore` até US-001-1-08. */
@Injectable()
export class LocalStartupStateReader extends StartupStateReader {
  private readonly store = inject(LocalSessionStore);

  readLocal(): LocalStartupState {
    return { hasApprovedHospitalLink: false, isLocked: false, isSessionValid: this.store.isValid() };
  }

  initialize(): Promise<void> {
    return Promise.resolve();
  }
}
