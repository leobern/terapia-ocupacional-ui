import { TestBed } from '@angular/core/testing';

import { Role, SessionRoleReader } from '../../shared/auth/session-role';
import { SessionManagerAccess } from './session-manager-access';

describe('SessionManagerAccess', () => {
  const isManager = (role: Role | null): boolean => {
    TestBed.configureTestingModule({
      providers: [SessionManagerAccess, { provide: SessionRoleReader, useValue: { read: (): Role | null => role } }],
    });

    return TestBed.inject(SessionManagerAccess).isManager();
  };

  it('só o perfil gestor é gestor', () => {
    expect(isManager(Role.GESTOR)).toBeTrue();
  });

  it('os demais perfis e a ausência de sessão não são', () => {
    expect(isManager(Role.TERAPEUTA)).toBeFalse();
  });

  it('sem sessão não é gestor', () => {
    expect(isManager(null)).toBeFalse();
  });
});
