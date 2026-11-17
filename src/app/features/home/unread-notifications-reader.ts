/**
 * Fronteira de leitura da contagem de notificações não lidas do profissional autenticado.
 *
 * DEPENDÊNCIA: a especificação de notificações fornecerá a implementação real,
 * substituindo `LocalUnreadNotificationsReader` em `app.config.ts`.
 */
export abstract class UnreadNotificationsReader {
  /** Quantidade de notificações não lidas. */
  abstract countUnread(): Promise<number>;
}
