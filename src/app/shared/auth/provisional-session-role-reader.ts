import { Injectable } from '@angular/core';

import { Role, SessionRoleReader } from './session-role';

/** Provisório: sem sessão no frontend ainda, o usuário de exemplo é gestor. */
@Injectable()
export class ProvisionalSessionRoleReader extends SessionRoleReader {
  read(): Role {
    return Role.GESTOR;
  }
}
