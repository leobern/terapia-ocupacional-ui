import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LocalSessionStore } from '../auth/local-session-store';
import { APPROVED_LINK_CACHE_KEY, LocalStartupStateReader } from './local-startup-state-reader';

describe('LocalStartupStateReader', () => {
  let reader: LocalStartupStateReader;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem(APPROVED_LINK_CACHE_KEY);
    TestBed.configureTestingModule({
      providers: [LocalStartupStateReader, provideHttpClient(), provideHttpClientTesting()],
    });
    reader = TestBed.inject(LocalStartupStateReader);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => localStorage.removeItem(APPROVED_LINK_CACHE_KEY));

  it('starts without session and without approved link', () => {
    expect(reader.readLocal()).toEqual({ hasApprovedHospitalLink: false, isLocked: false, isSessionValid: false });
  });

  it('reflects no session after the local store is cleared', () => {
    TestBed.inject(LocalSessionStore).clear();

    expect(reader.readLocal().isSessionValid).toBeFalse();
  });

  it('reports locked after 30 minutes in the background with a valid session', () => {
    TestBed.inject(LocalSessionStore).open({ accessToken: 'a', refreshToken: 'r' });
    localStorage.setItem('session.backgroundedAt', String(Date.now() - 31 * 60 * 1000));

    expect(reader.readLocal().isLocked).toBeTrue();
    TestBed.inject(LocalSessionStore).clear();
  });

  it('reads hasApprovedLink from GET /v1/vinculos and caches it', async () => {
    const done = reader.initialize();

    http
      .expectOne(r => r.method === 'GET' && r.url.endsWith('/v1/vinculos'))
      .flush({ hasApprovedLink: true, items: [] });
    await done;

    expect(reader.readLocal().hasApprovedHospitalLink).toBeTrue();
    expect(localStorage.getItem(APPROVED_LINK_CACHE_KEY)).toBe('true');
  });

  it('updates the cache when the link is no longer approved', async () => {
    localStorage.setItem(APPROVED_LINK_CACHE_KEY, 'true');
    const done = reader.initialize();

    http.expectOne(r => r.url.endsWith('/v1/vinculos')).flush({ hasApprovedLink: false, items: [] });
    await done;

    expect(reader.readLocal().hasApprovedHospitalLink).toBeFalse();
  });

  it('keeps the last known value and resolves on network error', async () => {
    localStorage.setItem(APPROVED_LINK_CACHE_KEY, 'true');
    const done = reader.initialize();

    http.expectOne(r => r.url.endsWith('/v1/vinculos')).error(new ProgressEvent('error'));

    await expectAsync(done).toBeResolved();

    expect(reader.readLocal().hasApprovedHospitalLink).toBeTrue();
  });

  it('resolves and stays false on 401', async () => {
    const done = reader.initialize();

    http
      .expectOne(r => r.url.endsWith('/v1/vinculos'))
      .flush({ message: 'x' }, { status: 401, statusText: 'Unauthorized' });

    await expectAsync(done).toBeResolved();

    expect(reader.readLocal().hasApprovedHospitalLink).toBeFalse();
  });

  it('falls back safely when localStorage throws', async () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    const done = reader.initialize();

    http.expectOne(r => r.url.endsWith('/v1/vinculos')).flush({ hasApprovedLink: true, items: [] });

    await expectAsync(done).toBeResolved();

    expect(reader.readLocal().hasApprovedHospitalLink).toBeFalse();
  });
});
