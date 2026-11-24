import { LocalStartupState } from './startup-state';

export type SplashDestination = '/login' | '/lock' | '/home' | '/hospital-links' | '/tutorial';

/** Máquina de estados da splash + RN-03: decide o destino a partir do estado local. */
export function decideDestination(state: LocalStartupState, tutorialPending = false): SplashDestination {
  if (!state.isSessionValid) {
    return '/login';
  }
  if (state.isLocked) {
    return '/lock';
  }

  if (!state.hasApprovedHospitalLink) {
    return '/hospital-links';
  }

  // US-001-3-02: no primeiro acesso o tutorial vem antes do Painel Metabólico.
  return tutorialPending ? '/tutorial' : '/home';
}
