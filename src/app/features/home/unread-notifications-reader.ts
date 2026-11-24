/**
 * Fronteira de leitura da contagem de notificações não lidas do profissional autenticado.
 *
Implementada por `ApiUnreadNotificationsReader` (`GET /api/v1/notifications`), ligada em `app.config.ts`.
 */
export abstract class UnreadNotificationsReader {
  /** Quantidade de notificações não lidas. */
  abstract countUnread(): Promise<number>;
}
