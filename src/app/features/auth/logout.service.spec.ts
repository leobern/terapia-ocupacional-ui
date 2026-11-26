import { TestBed } from '@angular/core/testing';

import { LocalSessionStore } from './local-session-store';
import { LogoutService } from './logout.service';
import { SessionRevoker } from './session-revoker';

class FakeRevoker extends SessionRevoker {
  revokeCurrentDevice!: jasmine.Spy<() => Promise<void>>;
  revokeToken = (): Promise<void> => Promise.resolve();
}

const SENSITIVE_KEYS = ['jwt', 'auth_token', 'clinical.notes', 'hospital', 'user', 'token', 'session.x', 'cache.y'];

function expectSensitiveKeysGone(): void {
  SENSITIVE_KEYS.forEach(key => {
    expect(localStorage.getItem(key)).withContext(`localStorage ${key}`).toBeNull();
    expect(sessionStorage.getItem(key)).withContext(`sessionStorage ${key}`).toBeNull();
  });
}

describe('LogoutService', () => {
  let revoker: FakeRevoker;
  let service: LogoutService;

  beforeEach(() => {
    revoker = new FakeRevoker();
    revoker.revokeCurrentDevice = jasmine.createSpy('revokeCurrentDevice').and.resolveTo();
    TestBed.configureTestingModule({ providers: [{ provide: SessionRevoker, useValue: revoker }] });
    service = TestBed.inject(LogoutService);
    SENSITIVE_KEYS.forEach(key => {
      localStorage.setItem(key, 'x');
      sessionStorage.setItem(key, 'x');
    });
    localStorage.setItem('lang', 'pt-BR');
    sessionStorage.setItem('ui.sidebar', 'open');
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('revokes only the current device session and clears sensitive local cache', async () => {
    await service.logout();

    expect(revoker.revokeCurrentDevice).toHaveBeenCalledTimes(1);
    expectSensitiveKeysGone();

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

    expectSensitiveKeysGone();

    expect(localStorage.getItem('lang')).toBe('pt-BR');
    expect(sessionStorage.getItem('ui.sidebar')).toBe('open');
    expect(TestBed.inject(LocalSessionStore).isValid()).toBeFalse();
  });
});
