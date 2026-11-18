import { inject, Injectable } from '@angular/core';

import { NotificationsRepository } from '../notifications/data-access/notifications-repository.service';
import { UnreadNotificationsReader } from './unread-notifications-reader';

/** Provisório: conta as notificações pendentes do repositório em memória (o selo do sino). */
@Injectable()
export class LocalUnreadNotificationsReader extends UnreadNotificationsReader {
  private readonly repository = inject(NotificationsRepository);

  countUnread(): Promise<number> {
    return Promise.resolve(this.repository.list('pending', null, 1).totalCount);
  }
}
