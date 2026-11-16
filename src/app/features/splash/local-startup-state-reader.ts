import { Injectable } from '@angular/core';

import { LocalStartupState, StartupStateReader } from './startup-state';

/** Implementação provisória: nenhuma sessão existe até US-001-1-08. */
@Injectable()
export class LocalStartupStateReader extends StartupStateReader {
  readLocal(): LocalStartupState {
    return { hasApprovedHospitalLink: false, isLocked: false, isSessionValid: false };
  }

  initialize(): Promise<void> {
    return Promise.resolve();
  }
}
