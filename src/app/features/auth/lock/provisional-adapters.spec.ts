import { ProvisionalAccountPasswordVerifier } from './provisional-account-password-verifier';
import { ProvisionalBiometricAuth } from './provisional-biometric-auth';

describe('provisional lock adapters', () => {
  it('has no biometrics on the web', async () => {
    const biometric = new ProvisionalBiometricAuth();

    expect(await biometric.isAvailable()).toBeFalse();
    expect(await biometric.authenticate()).toBeFalse();
  });

  it('accepts only a non-empty password while there is no login API', async () => {
    const verifier = new ProvisionalAccountPasswordVerifier();

    expect(await verifier.verify('x')).toBeTrue();
    expect(await verifier.verify('')).toBeFalse();
  });
});
