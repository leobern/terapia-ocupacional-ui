import { TestBed } from '@angular/core/testing';

import { LocalSessionStore } from '../auth/local-session-store';
import { LocalStartupStateReader } from './local-startup-state-reader';

describe('LocalStartupStateReader (provisional)', () => {
  let reader: LocalStartupStateReader;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LocalStartupStateReader] });
    reader = TestBed.inject(LocalStartupStateReader);
  });

  it('reports no session and initializes successfully', async () => {
    expect(reader.readLocal().isSessionValid).toBeFalse();
    await expectAsync(reader.initialize()).toBeResolved();
  });

  it('reflects no session after the local store is cleared', () => {
    TestBed.inject(LocalSessionStore).clear();

    expect(reader.readLocal().isSessionValid).toBeFalse();
  });
});
