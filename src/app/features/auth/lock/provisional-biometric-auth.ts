import { Injectable } from '@angular/core';

import { BiometricAuth } from './biometric-auth';

/** Provisório: a web não tem biometria nativa, então o desbloqueio cai direto na senha (RN-04). */
@Injectable()
export class ProvisionalBiometricAuth extends BiometricAuth {
  isAvailable(): Promise<boolean> {
    return Promise.resolve(false);
  }

  authenticate(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
