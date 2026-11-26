import { TestBed } from '@angular/core/testing';

import { AuthGateway, LoginResult } from '../../login/auth-gateway';
import { LocalSessionStore } from '../local-session-store';
import { SessionRevoker } from '../session-revoker';
import { ApiAccountPasswordVerifier } from './api-account-password-verifier';

function tokenWith(claims: object): string {
  return `h.${btoa(JSON.stringify(claims))}.s`;
}

describe('ApiAccountPasswordVerifier', () => {
  let verifier: ApiAccountPasswordVerifier;
  let login: jasmine.Spy;
  let revokeToken: jasmine.Spy;
  let store: LocalSessionStore;

  beforeEach(() => {
    localStorage.clear();
    login = jasmine.createSpy('login');
    revokeToken = jasmine.createSpy('revokeToken').and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        ApiAccountPasswordVerifier,
        { provide: AuthGateway, useValue: { login } },
        { provide: SessionRevoker, useValue: { revokeToken } },
      ],
    });
    store = TestBed.inject(LocalSessionStore);
    store.open({ accessToken: tokenWith({ upn: 'a@b.com' }), refreshToken: 'antigo' });
    verifier = TestBed.inject(ApiAccountPasswordVerifier);
  });

  afterEach(() => localStorage.clear());

  it('reautentica com o e-mail do token e adota o novo par, revogando o refresh antigo', async () => {
    login.and.resolveTo({
      kind: 'success',
      tokens: { accessToken: 'novo-a', refreshToken: 'novo-r' },
    } satisfies LoginResult);

    expect(await verifier.verify('segredo')).toBe('ok');
    expect(login).toHaveBeenCalledWith('a@b.com', 'segredo');
    expect(store.accessToken()).toBe('novo-a');
    expect(store.refreshToken()).toBe('novo-r');
    expect(revokeToken).toHaveBeenCalledOnceWith('antigo');
  });

  it('ignora falha ao revogar o refresh antigo', async () => {
    revokeToken.and.rejectWith(new Error('rede'));
    login.and.resolveTo({ kind: 'success', tokens: { accessToken: 'n', refreshToken: 'r' } } satisfies LoginResult);

    expect(await verifier.verify('x')).toBe('ok');
  });

  it('em erro não troca a sessão', async () => {
    const before = store.accessToken();

    login.and.resolveTo({ kind: 'invalid-credentials' } satisfies LoginResult);

    expect(await verifier.verify('x')).toBe('invalid');
    login.and.resolveTo({ kind: 'locked' } satisfies LoginResult);

    expect(await verifier.verify('x')).toBe('locked');
    login.and.resolveTo({ kind: 'network-error' } satisfies LoginResult);

    expect(await verifier.verify('x')).toBe('unavailable');
    expect(store.accessToken()).toBe(before);
    expect(store.refreshToken()).toBe('antigo');
    expect(revokeToken).not.toHaveBeenCalled();
  });

  it('sem e-mail no token não há como validar', async () => {
    store.updateAccessToken('sem-claims');

    expect(await verifier.verify('x')).toBe('unavailable');
    expect(login).not.toHaveBeenCalled();
  });
});
