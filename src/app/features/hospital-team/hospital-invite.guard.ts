import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { ManagerAccessReader } from './hospital-invite-port';

/** Só o gestor acessa o convite; os demais perfis voltam para a Home. */
export const managerOnlyGuard: CanActivateFn = () =>
  inject(ManagerAccessReader).isManager() || inject(Router).createUrlTree(['/home']);
