import { inject, Injectable } from '@angular/core';
import { forkJoin, from, map, Observable, of, tap } from 'rxjs';

import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { PatientMessagesSource, PatientMessagesWriter } from '../../patient-messages/patient-messages-source';
import { sentThreadToNotification } from '../../patient-messages/sent-thread-notification';
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
  private readonly messages = inject(PatientMessagesSource);
  private readonly writer = inject(PatientMessagesWriter);
  private readonly now = inject(NOW);
  private readonly profile = inject(ProfessionalProfileReader);

  override getNotifications(
    _: number,
    status: NotificationStatus,
    cursor: string | null,
    limit = 10,
  ): Observable<NotificationPage> {
    const page = this.repository.list(status, cursor, limit);

    // Mensagens que o profissional enviou a partir do Hub (FR-010): entram na primeira página, no estado
    // compartilhado da thread (ativa/resolvida) — o mesmo registro que o card do Hub mostra.
    return forkJoin([of(page), from(this.messages.listBySender(this.profile.read().name))]).pipe(
      map(([base, sent]) => {
        const mine = sent
          .filter(thread => (thread.resolved ? 'resolved' : 'pending') === status)
          .map(sentThreadToNotification)
          .reverse();

        return cursor === null
          ? { ...base, items: [...mine, ...base.items], totalCount: base.totalCount + mine.length }
          : { ...base, totalCount: base.totalCount + mine.length };
      }),
    );
  }

  override createReply(notificationId: number, text: string): Observable<NotificationReply> {
    return of(this.repository.addReply(notificationId, text));
  }

  override resolve(notificationId: number): Observable<void> {
    if (notificationId < 0) {
      // Thread enviada pelo Hub: o mesmo registro do card do Hub (estado único compartilhado).
      return from(
        this.writer.resolve({
          at: this.now().toISOString(),
          author: this.profile.read().name,
          threadId: `thread-${-notificationId}`,
        }),
      ).pipe(map(() => undefined));
    }

    // `resolveNotification` é x-implemented no contrato: chamada real; o mock local só espelha o estado.
    return super.resolve(notificationId).pipe(tap(() => this.repository.resolve(notificationId)));
  }
}
