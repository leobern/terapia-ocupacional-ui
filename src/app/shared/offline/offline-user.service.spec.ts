import { TestBed } from '@angular/core/testing';

import { LocalSessionStore } from '../../features/auth/local-session-store';
import { tokenFor } from './offline-testing.spec';
import { OfflineUserService } from './offline-user.service';

describe('OfflineUserService', () => {
  let session: LocalSessionStore;
  let service: OfflineUserService;

  beforeEach(() => {
    localStorage.clear();
    session = TestBed.inject(LocalSessionStore);
    service = TestBed.inject(OfflineUserService);
  });

  afterEach(() => localStorage.clear());

  it('usa a claim upn em minúsculas', () => {
    session.open({ accessToken: tokenFor({ upn: ' Almira@Conductia.com ' }), refreshToken: 'r' });

    expect(service.userId()).toBe('almira@conductia.com');
  });

  it('cai em sub quando não há upn', () => {
    session.open({ accessToken: tokenFor({ sub: 'u-9' }), refreshToken: 'r' });

    expect(service.userId()).toBe('u-9');
  });

  it('devolve null sem sessão ou sem claim estável', () => {
    expect(service.userId()).toBeNull();
    session.open({ accessToken: tokenFor({ upn: '  ' }), refreshToken: 'r' });

    expect(service.userId()).toBeNull();
  });
});
