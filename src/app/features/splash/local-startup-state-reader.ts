import { Injectable } from '@angular/core';

import { LocalStartupState, StartupStateReader } from './startup-state';

/**
 * Implementação provisória: sem persistência até US-001-1-08, o estado vive só em
 * memória (reflete o último login feito nesta execução do app).
 */
@Injectable()
export class LocalStartupStateReader extends StartupStateReader {
  private state: LocalStartupState = { hasApprovedHospitalLink: false, isLocked: false, isSessionValid: false };

  readLocal(): LocalStartupState {
    return this.state;
  }

  registerLogin(hasApprovedHospitalLink: boolean): void {
    this.state = { hasApprovedHospitalLink, isLocked: false, isSessionValid: true };
  }

  initialize(): Promise<void> {
    return Promise.resolve();
  }
}
