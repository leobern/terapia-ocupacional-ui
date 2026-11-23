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
    localStorage.setItem('session.refresh', 'r');
    localStorage.setItem('lang', 'pt-BR');
    sessionStorage.setItem('patients', 'y');
    sessionStorage.setItem('cache.beds', 'z');
    sessionStorage.setItem('ui.sidebar', 'open');
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('revokes only the current device session and clears sensitive local cache', async () => {
    await service.logout();

    expect(revoker.revokeCurrentDevice).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('session.refresh')).toBeNull();
    expect(sessionStorage.getItem('patients')).toBeNull();
    expect(sessionStorage.getItem('cache.beds')).toBeNull();
    expect(localStorage.getItem('lang')).toBe('pt-BR');
    expect(sessionStorage.getItem('ui.sidebar')).toBe('open');
    expect(TestBed.inject(LocalSessionStore).isValid()).toBeFalse();
  });

  it('exposes only the current-device revocation (no sign-out-everywhere)', async () => {
    await service.logout();

    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(service)).filter(m => m !== 'constructor');

    expect(methods).toEqual(['logout']);
    expect(Object.keys(revoker).filter(k => /all/i.test(k))).toEqual([]);
    expect(revoker.revokeCurrentDevice).toHaveBeenCalledOnceWith();
  });

  it('still clears local data when remote revocation fails', async () => {
    revoker.revokeCurrentDevice.and.rejectWith(new Error('offline'));

    await expectAsync(service.logout()).toBeResolved();

    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('cache.beds')).toBeNull();
    expect(localStorage.getItem('lang')).toBe('pt-BR');
    expect(TestBed.inject(LocalSessionStore).isValid()).toBeFalse();
  });
});
