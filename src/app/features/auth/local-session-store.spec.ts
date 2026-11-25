import { TestBed } from '@angular/core/testing';

import { LocalSessionStore } from './local-session-store';

const ARBITRARY_KEYS = ['jwt', 'auth_token', 'clinical.notes', 'hospital', 'user', 'token', 'session.x', 'cache.y'];

describe('LocalSessionStore', () => {
  let store: LocalSessionStore;

  beforeEach(() => {
    store = TestBed.inject(LocalSessionStore);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('starts with no valid session', () => {
    expect(store.isValid()).toBeFalse();
  });

  it('persists the session across openings and exposes the tokens', () => {
    store.open({ accessToken: 'a1', refreshToken: 'r1' });

    expect(store.isValid()).toBeTrue();
    expect(store.accessToken()).toBe('a1');
    expect(store.refreshToken()).toBe('r1');
    expect(TestBed.runInInjectionContext(() => new LocalSessionStore()).isValid()).toBeTrue();
  });

  it('replaces both tokens on a rotating renewal', () => {
    store.open({ accessToken: 'a1', refreshToken: 'r1' });
    store.updateTokens({ accessToken: 'a2', refreshToken: 'r2' });

    expect(store.accessToken()).toBe('a2');
    expect(store.refreshToken()).toBe('r2');
    expect(store.accessTokenSignal()).toBe('a2');
  });

  it('replaces only the access token on renewal', () => {
    store.open({ accessToken: 'a1', refreshToken: 'r1' });
    store.updateAccessToken('a2');

    expect(store.accessToken()).toBe('a2');
    expect(store.refreshToken()).toBe('r1');
  });

  it('clear ends the persisted session', () => {
    store.open({ accessToken: 'a1', refreshToken: 'r1' });
    store.clear();

    expect(store.isValid()).toBeFalse();
    expect(store.accessToken()).toBeNull();
    expect(TestBed.runInInjectionContext(() => new LocalSessionStore()).isValid()).toBeFalse();
  });

  it('treats unavailable storage as no session', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');

    expect(store.accessToken()).toBeNull();
  });

  it('fails closed: removes every arbitrary key from both storages', () => {
    ARBITRARY_KEYS.forEach(key => {
      localStorage.setItem(key, 'v');
      sessionStorage.setItem(key, 'v');
    });

    store.clear();

    ARBITRARY_KEYS.forEach(key => {
      expect(localStorage.getItem(key)).withContext(`localStorage ${key}`).toBeNull();
      expect(sessionStorage.getItem(key)).withContext(`sessionStorage ${key}`).toBeNull();
    });
  });

  it('keeps only the allowlisted preferences', () => {
    localStorage.setItem('lang', 'pt-BR');
    localStorage.setItem('ui.sidebar', 'open');
    localStorage.setItem('jwt', 'secret');
    sessionStorage.setItem('lang', 'en');
    sessionStorage.setItem('ui.sidebar', 'closed');
    sessionStorage.setItem('clinical.notes', 'secret');

    store.clear();

    expect(localStorage.getItem('lang')).toBe('pt-BR');
    expect(localStorage.getItem('ui.sidebar')).toBe('open');
    expect(sessionStorage.getItem('lang')).toBe('en');
    expect(sessionStorage.getItem('ui.sidebar')).toBe('closed');
    expect(localStorage.length).toBe(2);
    expect(sessionStorage.length).toBe(2);
  });
});
