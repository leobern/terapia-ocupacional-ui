import { inject, Injectable } from '@angular/core';

import { Role, SessionRoleReader } from '../../shared/auth/session-role';
import { ManagerAccessReader } from './hospital-invite-port';

/** O gestor é quem tem o perfil GESTOR na sessão (o backend também barra os demais, 403). */
@Injectable()
export class SessionManagerAccess extends ManagerAccessReader {
  private readonly role = inject(SessionRoleReader);

  isManager(): boolean {
    return this.role.read() === Role.GESTOR;
  }
}
