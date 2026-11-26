import { inject, Injectable } from '@angular/core';

import { readClaims } from '../../shared/auth/jwt-claims';
import { LocalSessionStore } from '../auth/local-session-store';
import { ProfessionalProfile, ProfessionalProfileReader } from './professional-profile';

/** Perfil usado sem sessão real (modo dev com token de teste): o mesmo fixo de antes. */
const FALLBACK_PROFILE: ProfessionalProfile = { name: 'Michelle Franklin', role: 'doctor' };

/**
 * Perfil do profissional a partir do access token da sessão (claim `nomeCompleto`). PENDÊNCIA: o
 * backend não distingue médico dos demais (só ADMIN, GESTOR, TERAPEUTA e RECECIONISTA), então
 * `role` segue `doctor` como antes até o Thiago definir a regra. Sem nome no token, usa o perfil fixo.
 */
@Injectable()
export class LocalProfessionalProfileReader extends ProfessionalProfileReader {
  private readonly session = inject(LocalSessionStore);

  read(): ProfessionalProfile {
    const { nomeCompleto } = readClaims(this.session.accessToken());

    return typeof nomeCompleto === 'string' && nomeCompleto.trim() !== ''
      ? { ...FALLBACK_PROFILE, name: nomeCompleto.trim() }
      : FALLBACK_PROFILE;
  }
}
