import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Role, SessionRoleReader } from './session-role';

/** Libera a rota só para o perfil gestor (FR-006a/FR-012); os demais voltam para a Home. */
export const gestorGuard: CanActivateFn = () =>
  inject(SessionRoleReader).read() === Role.GESTOR || inject(Router).createUrlTree(['/home']);
