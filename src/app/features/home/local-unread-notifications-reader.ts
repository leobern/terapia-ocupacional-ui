import { Injectable } from '@angular/core';

import { UnreadNotificationsReader } from './unread-notifications-reader';

/** Implementação provisória: nenhuma notificação existe até a especificação própria. */
@Injectable()
export class LocalUnreadNotificationsReader extends UnreadNotificationsReader {
  countUnread(): Promise<number> {
    return Promise.resolve(0);
  }
}
