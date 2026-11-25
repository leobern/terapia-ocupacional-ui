import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';

import { LocalSessionStore } from '../../features/auth/local-session-store';
import { gestorGuard } from './gestor.guard';
import { JwtSessionRoleReader } from './jwt-session-role-reader';
import { Role, SessionRoleReader } from './session-role';

class FakeRole extends SessionRoleReader {
  constructor(private readonly role: Role | null) {
    super();
  }
  read(): Role | null {
    return this.role;
  }
}

describe('gestorGuard', () => {
  const run = (role: Role | null): unknown => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SessionRoleReader, useValue: new FakeRole(role) }],
    });

    return TestBed.runInInjectionContext(() => gestorGuard({} as never, {} as never));
  };

  it('libera o gestor', () => {
    expect(run(Role.GESTOR)).toBe(true);
  });

  it('nega os demais perfis e volta para a Home', () => {
    const result = run(Role.TERAPEUTA);

    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/home');
  });

  it('nega quando não há perfil (sem sessão)', () => {
    expect(run(null) instanceof UrlTree).toBe(true);
  });
});

describe('JwtSessionRoleReader', () => {
  const jwt = (claims: unknown): string => {
    const encode = (value: unknown): string =>
      btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

    return `${encode({ alg: 'RS256' })}.${encode(claims)}.assinatura`;
  };

  let store: LocalSessionStore;
  let reader: JwtSessionRoleReader;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [JwtSessionRoleReader] });
    store = TestBed.inject(LocalSessionStore);
    reader = TestBed.inject(JwtSessionRoleReader);
  });

  afterEach(() => localStorage.clear());

  it('sem sessão não há perfil', () => {
    expect(reader.read()).toBeNull();
  });

  it('lê o perfil do claim groups ao abrir a sessão', () => {
    store.open({ accessToken: jwt({ groups: ['GESTOR'] }), refreshToken: 'r' });

    expect(reader.read()).toBe(Role.GESTOR);
  });

  it('acompanha a renovação do token e o logout', () => {
    store.open({ accessToken: jwt({ groups: ['TERAPEUTA'] }), refreshToken: 'r' });

    expect(reader.read()).toBe(Role.TERAPEUTA);

    store.updateAccessToken(jwt({ groups: ['GESTOR'] }));

    expect(reader.read()).toBe(Role.GESTOR);

    store.clear();

    expect(reader.read()).toBeNull();
  });

  it('falha fechada com token malformado, sem groups ou com perfil desconhecido', () => {
    store.open({ accessToken: 'nao-e-jwt', refreshToken: 'r' });

    expect(reader.read()).toBeNull();

    store.updateAccessToken('a.%%%.c');

    expect(reader.read()).toBeNull();

    store.updateAccessToken(jwt({ sub: 'x' }));

    expect(reader.read()).toBeNull();

    store.updateAccessToken(jwt({ groups: 'GESTOR' }));

    expect(reader.read()).toBeNull();

    store.updateAccessToken(jwt({ groups: ['OUTRO'] }));

    expect(reader.read()).toBeNull();
  });
});
