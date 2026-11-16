import { LocalStartupStateReader } from './local-startup-state-reader';

describe('LocalStartupStateReader (provisional)', () => {
  it('reports no session and initializes successfully', async () => {
    const reader = new LocalStartupStateReader();

    expect(reader.readLocal().isSessionValid).toBeFalse();
    await expectAsync(reader.initialize()).toBeResolved();
  });

  it('registers a login in memory: valid session, unlocked, with the given link state', () => {
    const reader = new LocalStartupStateReader();

    reader.registerLogin(true);

    expect(reader.readLocal()).toEqual({ hasApprovedHospitalLink: true, isLocked: false, isSessionValid: true });
  });
});
