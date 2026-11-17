import { Injectable } from '@angular/core';

import { HomeNotification } from './home.models';
import { HomeNotificationsSource } from './home-notifications';

/** Provisório: sem backend ligado à Home, nenhuma notificação. */
@Injectable()
export class ProvisionalHomeNotificationsSource extends HomeNotificationsSource {
  loadForHospital(): Promise<readonly HomeNotification[]> {
    return Promise.resolve([] as readonly HomeNotification[]);
  }
}
