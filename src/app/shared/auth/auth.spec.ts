import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';

import { gestorGuard } from './gestor.guard';
import { ProvisionalSessionRoleReader } from './provisional-session-role-reader';
import { Role, SessionRoleReader } from './session-role';

class FakeRole extends SessionRoleReader {
  constructor(private readonly role: Role) {
    super();
  }
  read(): Role {
    return this.role;
  }
}

describe('gestorGuard', () => {
  const run = (role: Role): unknown => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SessionRoleReader, useValue: new FakeRole(role) }],
    });

    return TestBed.runInInjectionContext(() => gestorGuard({} as never, {} as never));
  };

  it('libera o gestor', () => {
    expect(run(Role.GESTOR)).toBe(true);
  });

  it('nega os demais perfis e volta para a Home', () => {
    const result = run(Role.MEDICO);

    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/home');
  });

  it('o provisório é gestor', () => {
    expect(new ProvisionalSessionRoleReader().read()).toBe(Role.GESTOR);
  });
});
