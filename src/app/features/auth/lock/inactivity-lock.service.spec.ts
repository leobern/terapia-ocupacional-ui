import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { LocalSessionStore } from '../local-session-store';
import {
  BACKGROUNDED_AT_KEY,
  INACTIVITY_LIMIT_MS,
  InactivityLockService,
  LOCK_RETURN_URL_KEY,
  LOCK_STATE_KEY,
} from './inactivity-lock.service';

describe('InactivityLockService', () => {
  const T0 = 1_000_000;
  let service: InactivityLockService;
  let router: jasmine.SpyObj<Router>;

  function setup(url = '/patients/1', valid = true): void {
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl'], { url });
    router.navigateByUrl.and.resolveTo(true);
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });

    if (valid) {
      TestBed.inject(LocalSessionStore).open({ accessToken: 'a', refreshToken: 'r' });
    }

    service = TestBed.inject(InactivityLockService);
  }

  afterEach(() => localStorage.clear());

  it('persists the timestamp when the app goes to the background', () => {
    setup();
    service.markBackgrounded(T0);

    expect(localStorage.getItem(BACKGROUNDED_AT_KEY)).toBe(String(T0));
  });

  it('C1: stays unlocked and keeps the screen at 29:59', () => {
    setup();
    service.markBackgrounded(T0);
    service.resume(T0 + INACTIVITY_LIMIT_MS - 1000);

    expect(service.lockState()).toBe('UNLOCKED');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('C2: locks at exactly 30:00, stores the origin route and shows the LockScreen', () => {
    setup('/patients/1');
    service.markBackgrounded(T0);
    service.resume(T0 + INACTIVITY_LIMIT_MS);

    expect(service.lockState()).toBe('LOCKED');
    expect(service.returnUrl()).toBe('/patients/1');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/lock', { replaceUrl: true });
  });

  it('a forced close does not restart the clock: a new instance still locks', () => {
    setup();
    service.markBackgrounded(T0);
    TestBed.resetTestingModule();
    setup();

    expect(service.evaluate(T0 + INACTIVITY_LIMIT_MS + 1)).toBe('LOCKED');
  });

  it('stays locked after reopening and does not overwrite the timestamp while locked', () => {
    setup();
    service.markBackgrounded(T0);
    service.evaluate(T0 + INACTIVITY_LIMIT_MS);
    service.markBackgrounded(T0 + INACTIVITY_LIMIT_MS + 5);
    TestBed.resetTestingModule();
    setup();

    expect(service.isLocked()).toBeTrue();
    expect(localStorage.getItem(BACKGROUNDED_AT_KEY)).toBe(String(T0));
  });

  it('never locks without a valid session', () => {
    setup('/home', false);
    service.markBackgrounded(T0);
    service.resume(T0 + INACTIVITY_LIMIT_MS * 5);

    expect(service.lockState()).toBe('UNLOCKED');
    expect(localStorage.getItem(BACKGROUNDED_AT_KEY)).toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not navigate again when the LockScreen is already shown', () => {
    setup('/lock');
    service.markBackgrounded(T0);
    service.resume(T0 + INACTIVITY_LIMIT_MS);

    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(service.returnUrl()).toBe('/home');
  });

  it('falls back to home for technical routes', () => {
    setup('/splash');
    service.markBackgrounded(T0);
    service.evaluate(T0 + INACTIVITY_LIMIT_MS);

    expect(service.returnUrl()).toBe('/home');
  });

  it('evaluate without a stored timestamp keeps the state', () => {
    setup();

    expect(service.evaluate(T0)).toBe('UNLOCKED');
  });

  it('unlock clears the lock state, timestamp and return route', () => {
    setup();
    service.markBackgrounded(T0);
    service.evaluate(T0 + INACTIVITY_LIMIT_MS);
    service.unlock();

    expect(service.isLocked()).toBeFalse();
    expect(localStorage.getItem(BACKGROUNDED_AT_KEY)).toBeNull();
    expect(localStorage.getItem(LOCK_STATE_KEY)).toBeNull();
    expect(localStorage.getItem(LOCK_RETURN_URL_KEY)).toBeNull();
  });

  it('reacts to the page lifecycle events once', () => {
    let visibility = 'hidden';

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    setup();
    service.start();
    service.start();
    document.dispatchEvent(new Event('visibilitychange'));

    expect(localStorage.getItem(BACKGROUNDED_AT_KEY)).not.toBeNull();

    localStorage.setItem(BACKGROUNDED_AT_KEY, String(Date.now() - INACTIVITY_LIMIT_MS));
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    delete (document as unknown as Record<string, unknown>)['visibilityState'];

    expect(service.isLocked()).toBeTrue();
    expect(router.navigateByUrl).toHaveBeenCalledTimes(1);
  });

  it('stops listening when destroyed', () => {
    setup();
    service.start();
    TestBed.resetTestingModule();
    window.dispatchEvent(new Event('pagehide'));

    expect(localStorage.getItem(BACKGROUNDED_AT_KEY)).toBeNull();
  });

  it('persists the timestamp on pagehide', () => {
    setup();
    service.start();
    window.dispatchEvent(new Event('pagehide'));

    expect(localStorage.getItem(BACKGROUNDED_AT_KEY)).not.toBeNull();
  });

  it('survives unavailable storage', () => {
    setup();
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    service.markBackgrounded(T0);

    expect(service.isLocked()).toBeFalse();
  });
});
