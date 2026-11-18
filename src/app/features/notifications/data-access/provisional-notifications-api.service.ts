import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { HomeApiService } from '../../home/data-access/home-api.service';
import { type Hospital } from '../../home/home.models';
import { type NotificationPage, type NotificationReply, type NotificationStatus } from '../notifications.models';
import { NotificationsApiService } from './notifications-api.service';
import { NotificationsRepository } from './notifications-repository.service';

/**
 * Provisório: lê/grava no `NotificationsRepository` (memória) em vez de chamar a API HTTP,
 * que ainda não existe. Substituído por `NotificationsApiService` em `app.config.ts` quando
 * o backend estiver pronto.
 */
@Injectable()
export class ProvisionalNotificationsApiService extends NotificationsApiService {
  private readonly repository = inject(NotificationsRepository);

  override getNotifications(
    _: number,
    status: NotificationStatus,
    cursor: string | null,
    limit = 10,
  ): Observable<NotificationPage> {
    return of(this.repository.list(status, cursor, limit));
  }

  override createReply(notificationId: number, text: string): Observable<NotificationReply> {
    return of(this.repository.addReply(notificationId, text));
  }
}

/** Provisório: um único hospital, o mesmo da Home (`MockLinkedHospitalsReader`). */
@Injectable()
export class ProvisionalHomeApiService extends HomeApiService {
  override getHospitals(): Observable<Hospital[]> {
    return of([{ id: 1, name: 'Hospital Vila Nova Star' }]);
  }
}
