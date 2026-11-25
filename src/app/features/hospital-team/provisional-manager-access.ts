import { Injectable } from '@angular/core';

import { ManagerAccessReader } from './hospital-invite-port';

/** Provisório: o perfil gestor é atribuído pela equipe Conductia; aqui o usuário de exemplo é gestor. */
@Injectable()
export class ProvisionalManagerAccess extends ManagerAccessReader {
  isManager(): boolean {
    return true;
  }
}
