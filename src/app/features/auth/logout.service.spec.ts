import { TestBed } from '@angular/core/testing';

import { LocalSessionStore } from './local-session-store';
import { LogoutService } from './logout.service';
import { SessionRevoker } from './session-revoker';

class FakeRevoker extends SessionRevoker {
  revokeCurrentDevice!: jasmine.Spy<() => Promise<void>>;
}

describe('LogoutService', () => {
  let revoker: FakeRevoker;
  let service: LogoutService;

  beforeEach(() => {
    revoker = new FakeRevoker();
    revoker.revokeCurrentDevice = jasmine.createSpy('revokeCurrentDevice').and.resolveTo();
    TestBed.configureTestingModule({ providers: [{ provide: SessionRevoker, useValue: revoker }] });
    service = TestBed.inject(LogoutService);
    localStorage.setItem('token', 'x');
    sessionStorage.setItem('patients', 'y');
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('revokes only the current device session and clears sensitive local cache', async () => {
    await service.logout();

    expect(revoker.revokeCurrentDevice).toHaveBeenCalledTimes(1);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(TestBed.inject(LocalSessionStore).isValid()).toBeFalse();
  });

  it('still clears local data when remote revocation fails', async () => {
    revoker.revokeCurrentDevice.and.rejectWith(new Error('offline'));

    await expectAsync(service.logout()).toBeResolved();

    expect(localStorage.getItem('token')).toBeNull();
    expect(TestBed.inject(LocalSessionStore).isValid()).toBeFalse();
  });
});
