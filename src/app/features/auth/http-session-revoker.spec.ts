import { TestBed } from '@angular/core/testing';

import { HttpSessionRevoker } from './http-session-revoker';
import { LocalSessionStore } from './local-session-store';

describe('HttpSessionRevoker', () => {
  let revoker: HttpSessionRevoker;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    spyOn(window, 'fetch');
    fetchSpy = window.fetch as jasmine.Spy;
    fetchSpy.and.resolveTo(new Response(null, { status: 204 }));
    TestBed.configureTestingModule({ providers: [HttpSessionRevoker] });
    revoker = TestBed.inject(HttpSessionRevoker);
  });

  afterEach(() => localStorage.clear());

  it('envia o refresh token do dispositivo ao endpoint de logout', async () => {
    TestBed.inject(LocalSessionStore).open({ accessToken: 'a1', refreshToken: 'r1' });

    await revoker.revokeCurrentDevice();

    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];

    expect(url).toBe('/api/v1/auth/logout');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'r1' });
    expect(init.signal).toBeDefined();
  });

  it('sem refresh token não chama a rede', async () => {
    await revoker.revokeCurrentDevice();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('revoga um refresh token específico', async () => {
    await revoker.revokeToken('antigo');

    const init = fetchSpy.calls.mostRecent().args[1] as RequestInit;

    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'antigo' });
  });

  it('rejeita em resposta de erro para o logout local seguir sem travar', async () => {
    fetchSpy.and.resolveTo(new Response(null, { status: 500 }));

    await expectAsync(revoker.revokeToken('r')).toBeRejectedWithError(/500/);
  });
});
