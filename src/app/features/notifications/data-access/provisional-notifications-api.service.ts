import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { type NotificationReply } from '../notifications.models';
import { NotificationsApiService } from './notifications-api.service';
import { NotificationsRepository } from './notifications-repository.service';

/**
 * Provisório só para as operações que o contrato marca `x-implemented: false` (responder e
 * resolver): grava no `NotificationsRepository` (memória). `getNotifications` e `markAsRead`
 * já existem no backend e herdam o cliente HTTP real.
 */
@Injectable()
export class ProvisionalNotificationsApiService extends NotificationsApiService {
  private readonly repository = inject(NotificationsRepository);

  override createReply(notificationId: number, text: string): Observable<NotificationReply> {
    return of(this.repository.addReply(notificationId, text));
  }

  override resolve(notificationId: number): Observable<void> {
    this.repository.resolve(notificationId);

    return of(undefined);
  }
}
