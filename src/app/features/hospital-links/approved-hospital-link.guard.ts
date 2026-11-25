import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { HospitalLinksSource } from './hospital-links-source';

/** Query param que marca o redirecionamento por falta de vínculo aprovado (mostra o aviso). */
export const ACCESS_BLOCKED_PARAM = 'acesso';
export const ACCESS_BLOCKED_VALUE = 'bloqueado';

/**
 * Painel Metabólico só abre com ao menos um vínculo aprovado (US-001-2-02, cenário 3):
 * sem ele, vai à tela de vínculos com o aviso de acesso ainda não liberado.
 * Falha ao consultar os vínculos deixa passar: a tela de vínculos nunca é guardada por
 * este guard, então não há loop e o erro aparece onde já existe tratamento.
 */
export const approvedHospitalLinkGuard: CanActivateFn = async () => {
  const router = inject(Router);

  try {
    const { hasApprovedLink } = await inject(HospitalLinksSource).list();

    return hasApprovedLink
      ? true
      : router.createUrlTree(['/hospital-links'], { queryParams: { [ACCESS_BLOCKED_PARAM]: ACCESS_BLOCKED_VALUE } });
  } catch {
    return true;
  }
};
