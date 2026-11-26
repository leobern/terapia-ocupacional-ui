import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';

import { LocalSessionStore } from './local-session-store';
import { sessionAuthInterceptor } from './session-auth.interceptor';
import { SessionRenewalService } from './session-renewal.service';

describe('sessionAuthInterceptor', () => {
  const url = `${environment.apiBaseUrl}/v1/x`;
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let renew: jasmine.Spy;
  let store: LocalSessionStore;

  beforeEach(() => {
    renew = jasmine.createSpy('renew').and.callFake(() => {
      store.updateAccessToken('novo');

      return Promise.resolve('novo');
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionAuthInterceptor])),
        provideHttpClientTesting(),
        { provide: SessionRenewalService, useValue: { renew } },
      ],
    });
    store = TestBed.inject(LocalSessionStore);
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => localStorage.clear());

  it('sends the access token on API calls', () => {
    store.open({ accessToken: 'a1', refreshToken: 'r1' });
    http.get(url).subscribe();

    expect(ctrl.expectOne(url).request.headers.get('Authorization')).toBe('Bearer a1');
  });

  it('does nothing without a session, off the API, or with an Authorization already set', () => {
    http.get(url).subscribe();
    store.open({ accessToken: 'a1', refreshToken: 'r1' });
    http.get('https://outro.example/x').subscribe();
    http.get(url, { headers: { Authorization: 'Bearer dev' } }).subscribe();

    const calls = ctrl.match(() => true);

    expect(calls[0].request.headers.has('Authorization')).toBeFalse();
    expect(calls[1].request.headers.has('Authorization')).toBeFalse();
    expect(calls[2].request.headers.get('Authorization')).toBe('Bearer dev');
  });

  it('C5: on 401 renews and repeats the call transparently', () => {
    store.open({ accessToken: 'velho', refreshToken: 'r1' });
    const next = jasmine.createSpy('next');
    const failed = jasmine.createSpy('failed');

    http.get(url).subscribe({ error: failed, next });
    ctrl.expectOne(url).flush('', { status: 401, statusText: 'Unauthorized' });

    return Promise.resolve().then(() => {
      const retry = ctrl.expectOne(url);

      expect(retry.request.headers.get('Authorization')).toBe('Bearer novo');
      retry.flush({ ok: true });

      expect(next).toHaveBeenCalledWith({ ok: true });
      expect(failed).not.toHaveBeenCalled();
      expect(renew).toHaveBeenCalledTimes(1);
    });
  });

  it('reuses a token another call already renewed, without renewing again', async () => {
    store.open({ accessToken: 'velho', refreshToken: 'r1' });
    http.get(url).subscribe();
    store.updateAccessToken('ja-renovado');
    ctrl.expectOne(url).flush('', { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();

    expect(ctrl.expectOne(url).request.headers.get('Authorization')).toBe('Bearer ja-renovado');
    expect(renew).not.toHaveBeenCalled();
  });

  it('gives the original 401 back when the renewal fails', async () => {
    store.open({ accessToken: 'velho', refreshToken: 'r1' });
    renew.and.rejectWith(new Error('offline'));
    const failed = jasmine.createSpy('failed');

    http.get(url).subscribe({ error: failed });
    ctrl.expectOne(url).flush('', { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();
    await Promise.resolve();

    expect(failed.calls.mostRecent().args[0].status).toBe(401);
  });

  it('does not loop: a 401 on the repeated call is returned as is', async () => {
    store.open({ accessToken: 'velho', refreshToken: 'r1' });
    const failed = jasmine.createSpy('failed');

    http.get(url).subscribe({ error: failed });
    ctrl.expectOne(url).flush('', { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();
    ctrl.expectOne(url).flush('', { status: 401, statusText: 'Unauthorized' });

    expect(renew).toHaveBeenCalledTimes(1);
    expect(failed.calls.mostRecent().args[0].status).toBe(401);
  });

  it('passes other errors through untouched', () => {
    store.open({ accessToken: 'a1', refreshToken: 'r1' });
    const failed = jasmine.createSpy('failed');

    http.get(url).subscribe({ error: failed });
    ctrl.expectOne(url).flush('', { status: 500, statusText: 'Server Error' });

    expect(failed.calls.mostRecent().args[0].status).toBe(500);
    expect(renew).not.toHaveBeenCalled();
  });

  it('com só o refresh token renova antes de enviar', async () => {
    localStorage.setItem('session.refreshToken', 'r1');
    http.get(url).subscribe();
    await Promise.resolve();
    await Promise.resolve();

    expect(renew).toHaveBeenCalledWith();
    expect(ctrl.expectOne(url).request.headers.get('Authorization')).toBe('Bearer novo');
  });

  it('se a renovação falha, a chamada segue sem token', async () => {
    localStorage.setItem('session.refreshToken', 'r1');
    renew.and.rejectWith(new Error('x'));
    http.get(url).subscribe({ error: () => undefined });
    await Promise.resolve();
    await Promise.resolve();

    expect(ctrl.expectOne(url).request.headers.has('Authorization')).toBeFalse();
  });
});
