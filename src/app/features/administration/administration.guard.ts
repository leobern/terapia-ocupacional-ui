import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Role, SessionRoleReader } from '../../shared/auth/session-role';

/** Equipe e Hospitais (Administração): só ADMIN e GESTOR; os demais voltam para a Home. O backend também barra (403). */
export const administrationGuard: CanActivateFn = () =>
  [Role.ADMIN, Role.GESTOR].some(role => role === inject(SessionRoleReader).read()) ||
  inject(Router).createUrlTree(['/home']);
