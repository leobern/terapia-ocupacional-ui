import { Injectable } from '@angular/core';

import { NotificationPage } from './home.models';
import { HomeNotificationsSource } from './home-notifications-source';

/** Provisório: sem backend ligado, nenhuma notificação. */
@Injectable()
export class ProvisionalHomeNotificationsSource extends HomeNotificationsSource {
  loadPage(): Promise<NotificationPage> {
    return Promise.resolve({ items: [], nextCursor: null });
  }
}
