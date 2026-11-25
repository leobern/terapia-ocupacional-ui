import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { LocalSessionStore } from './local-session-store';
import { SessionRenewalService } from './session-renewal.service';
import { SessionRevoker } from './session-revoker';
import { RefreshRejectedError, TokenRefresher } from './token-refresher';

describe('SessionRenewalService', () => {
  let service: SessionRenewalService;
  let store: LocalSessionStore;
  let refresh: jasmine.Spy;
  let navigateByUrl: jasmine.Spy;

  beforeEach(() => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    refresh = jasmine.createSpy('refresh').and.resolveTo('novo');
    navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: TokenRefresher, useValue: { refresh } },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: SessionRevoker, useValue: { revokeCurrentDevice: (): Promise<void> => Promise.resolve() } },
      ],
    });
    store = TestBed.inject(LocalSessionStore);
    store.open({ accessToken: 'velho', refreshToken: 'r1' });
    service = TestBed.inject(SessionRenewalService);
  });

  afterEach(() => localStorage.clear());

  it('C5: renews with the refresh token and stores the new access token', async () => {
    expect(await service.renew()).toBe('novo');
    expect(refresh).toHaveBeenCalledWith('r1');
    expect(store.accessToken()).toBe('novo');
    expect(store.isValid()).toBeTrue();
  });

  it('concurrent calls trigger a single renewal', async () => {
    const results = await Promise.all([service.renew(), service.renew(), service.renew()]);

    expect(results).toEqual(['novo', 'novo', 'novo']);
    expect(refresh).toHaveBeenCalledTimes(1);

    await service.renew();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('C6: a definitive failure ends the session and goes to login with MSG-01', async () => {
    refresh.and.rejectWith(new RefreshRejectedError());

    await expectAsync(service.renew()).toBeRejectedWithError(RefreshRejectedError);

    expect(store.isValid()).toBeFalse();
    expect(store.refreshToken()).toBeNull();
    expect(navigateByUrl).toHaveBeenCalledWith('/login', {
      replaceUrl: true,
      state: { notice: 'Sua sessão expirou. Faça login novamente.' },
    });
  });

  it('a network failure keeps the session and does not navigate', async () => {
    refresh.and.rejectWith(new Error('offline'));

    await expectAsync(service.renew()).toBeRejectedWithError('offline');

    expect(store.isValid()).toBeTrue();
    expect(store.refreshToken()).toBe('r1');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('without a refresh token the renewal is definitively rejected', async () => {
    store.clear();

    await expectAsync(service.renew()).toBeRejectedWithError(RefreshRejectedError);

    expect(refresh).not.toHaveBeenCalled();
  });
});
