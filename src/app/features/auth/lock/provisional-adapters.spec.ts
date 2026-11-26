import { ProvisionalBiometricAuth } from './provisional-biometric-auth';

describe('provisional lock adapters', () => {
  it('has no biometrics on the web', async () => {
    const biometric = new ProvisionalBiometricAuth();

    expect(await biometric.isAvailable()).toBeFalse();
    expect(await biometric.authenticate()).toBeFalse();
  });
});
