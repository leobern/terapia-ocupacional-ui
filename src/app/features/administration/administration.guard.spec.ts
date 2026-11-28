import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';

import { Role, SessionRoleReader } from '../../shared/auth/session-role';
import { administrationGuard } from './administration.guard';

describe('administrationGuard', () => {
  function run(role: Role | null): unknown {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SessionRoleReader, useValue: { read: (): Role | null => role } }],
    });

    return TestBed.runInInjectionContext(() => administrationGuard({} as never, {} as never));
  }

  it('libera ADMIN e GESTOR', () => {
    expect(run(Role.ADMIN)).toBeTrue();
  });

  it('libera GESTOR', () => {
    expect(run(Role.GESTOR)).toBeTrue();
  });

  for (const role of [Role.TERAPEUTA, Role.MEDICO, Role.RECECIONISTA, null]) {
    it(`manda ${role ?? 'sem perfil'} para a Home`, () => {
      const result = run(role);

      expect(result instanceof UrlTree).toBeTrue();
      expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/home');
    });
  }
});
