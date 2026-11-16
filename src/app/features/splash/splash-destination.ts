import { LocalStartupState } from './startup-state';

export type SplashDestination = '/login' | '/lock' | '/home' | '/hospital-links';

/** Máquina de estados da splash + RN-03: decide o destino a partir do estado local. */
export function decideDestination(state: LocalStartupState): SplashDestination {
  if (!state.isSessionValid) {
    return '/login';
  }
  if (state.isLocked) {
    return '/lock';
  }

  return state.hasApprovedHospitalLink ? '/home' : '/hospital-links';
}
