import { HomeNotification, NotificationPage } from './home.models';

/** Tamanho do lote do feed de notificações da Home (RN-01/RN-02). */
export const NOTIFICATIONS_BATCH_SIZE = 10;

/**
 * Porta de leitura paginada (por cursor) das notificações do profissional no hospital em contexto,
 * da mais recente para a mais antiga. A implementação real substitui a provisória em `app.config.ts`.
 */
export abstract class HomeNotificationsSource {
  abstract loadPage(hospitalId: number, cursor: string | null, limit: number): Promise<NotificationPage>;
}

/**
 * RN-02/RN-03: da mais recente para a mais antiga; em empate exato de horário,
 * a criada por último (maior id, ordem de criação) vem primeiro.
 */
export function sortNotificationsNewestFirst(items: readonly HomeNotification[]): HomeNotification[] {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id);
}
