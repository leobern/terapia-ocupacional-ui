import { HomeNotification } from './home.models';

/**
 * Porta de leitura das notificações do profissional autenticado por hospital
 * (primeiro lote). A implementação real (HomeApiService.getNotifications, que
 * hoje exige id numérico de hospital) substitui a provisória em `app.config.ts`.
 */
export abstract class HomeNotificationsSource {
  abstract loadForHospital(hospitalId: string): Promise<readonly HomeNotification[]>;
}

/**
 * RN-02/RN-03: da mais recente para a mais antiga; em empate exato de horário,
 * a criada por último (maior id, ordem de criação) vem primeiro.
 */
export function sortNotificationsNewestFirst(items: readonly HomeNotification[]): HomeNotification[] {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id);
}
