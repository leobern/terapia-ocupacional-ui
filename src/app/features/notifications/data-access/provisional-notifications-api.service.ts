import { inject, Injectable, Injector } from '@angular/core';
import { from, map, Observable, of } from 'rxjs';

import { membersOfGroup } from '../../../shared/services/provisional-user-directory';
import { UserDirectory } from '../../../shared/services/user-directory';
import {
  type Notification,
  type NotificationPage,
  type NotificationReply,
  type NotificationStatus,
} from '../notifications.models';
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
  // Resolvido sob demanda: só o comunicado precisa do diretório de usuários.
  private readonly injector = inject(Injector);

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

  override createAnnouncement(
    _: number,
    content: string,
    recipientIds: readonly number[],
    groups: readonly (string | null)[] = [],
  ): Observable<Notification> {
    return from(this.injector.get(UserDirectory).search('')).pipe(
      map(users => {
        const people = users.filter(user => !user.group);
        const fromGroups = groups.flatMap(profile => membersOfGroup(profile));
        const recipients = people.filter(
          user => recipientIds.includes(user.id) || fromGroups.some(member => member.id === user.id),
        );

        return this.repository.create({ message: content, recipients });
      }),
    );
  }

  override resolve(notificationId: number): Observable<void> {
    this.repository.resolve(notificationId);

    return of(undefined);
  }
}
