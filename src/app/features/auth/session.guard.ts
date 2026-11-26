import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { environment } from '@environments/environment';

import { LocalSessionStore } from './local-session-store';
import { InactivityLockService } from './lock/inactivity-lock.service';

function isAllowed(): boolean {
  return inject(LocalSessionStore).isValid()
    ? inject(InactivityLockService).evaluate() !== 'LOCKED'
    : environment.devBackend === true;
}

function redirect(returnUrl: string): UrlTree {
  const router = inject(Router);

  return inject(LocalSessionStore).isValid()
    ? router.createUrlTree(['/lock'])
    : router.createUrlTree(['/login'], { queryParams: { returnUrl } });
}

/**
 * Protege as telas autenticadas. Sem sessão local vai ao login levando a rota pedida (`returnUrl`),
 * para voltar a ela depois de entrar; com o app bloqueado por inatividade vai à tela de bloqueio.
 * Com `environment.devBackend` (token de teste do `--configuration local`) a falta de sessão é
 * tolerada: quem não tem sessão real usa o token de dev. É só controle de interface; o backend autoriza (401/403).
 */
export const sessionGuard: CanActivateFn = (_, state) => isAllowed() || redirect(state.url);
