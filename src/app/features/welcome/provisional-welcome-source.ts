import { inject, Injectable } from '@angular/core';

import { ProfessionalProfileReader } from '../home/professional-profile';
import { StartupStateReader } from '../splash/startup-state';
import { WelcomeSource, WelcomeStatus } from './welcome-source';

/** Chave local do "já visto". Fora da allowlist de preferências: some no logout. */
export const WELCOME_SEEN_KEY = 'onboarding.welcomeSeen';

/** Fonte provisória (a API de onboarding ainda não está ligada): "já visto" no `localStorage`. */
@Injectable()
export class ProvisionalWelcomeSource extends WelcomeSource {
  private readonly startup = inject(StartupStateReader);
  private readonly profile = inject(ProfessionalProfileReader);

  getStatus(): Promise<WelcomeStatus> {
    const seen = localStorage.getItem(WELCOME_SEEN_KEY) === 'true';

    return Promise.resolve({
      name: this.profile.read().name,
      shouldShow: this.startup.readLocal().hasApprovedHospitalLink && !seen,
    });
  }

  complete(): Promise<void> {
    localStorage.setItem(WELCOME_SEEN_KEY, 'true');

    return Promise.resolve();
  }
}
