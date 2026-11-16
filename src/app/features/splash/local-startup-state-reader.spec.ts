import { LocalStartupStateReader } from './local-startup-state-reader';

describe('LocalStartupStateReader (provisional)', () => {
  it('reports no session and initializes successfully', async () => {
    const reader = new LocalStartupStateReader();

    expect(reader.readLocal().isSessionValid).toBeFalse();
    await expectAsync(reader.initialize()).toBeResolved();
  });
});
