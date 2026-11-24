import { inject, Injectable } from '@angular/core';
import { forkJoin, from, map, Observable, of } from 'rxjs';

import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { PatientMessagesSource, PatientMessagesWriter } from '../../patient-messages/patient-messages-source';
import { sentThreadToNotification } from '../../patient-messages/sent-thread-notification';
import { type NotificationPage, type NotificationReply, type NotificationStatus } from '../notifications.models';
import { NotificationsApiService } from './notifications-api.service';
import { NotificationsRepository } from './notifications-repository.service';

/**
 * Lista, responder, resolver e marcar como lida usam a API real (comunicados internos). O que ainda não
 * tem backend é a mensagem de paciente enviada pelo Hub (FT-005-1): ela entra aqui a partir do registro
 * provisório de threads. Substituído por `NotificationsApiService` em `app.config.ts` quando o Hub
 * também for para o backend.
 */
@Injectable()
export class ProvisionalNotificationsApiService extends NotificationsApiService {
  private readonly repository = inject(NotificationsRepository);
  private readonly messages = inject(PatientMessagesSource);
  private readonly writer = inject(PatientMessagesWriter);
  private readonly now = inject(NOW);
  private readonly profile = inject(ProfessionalProfileReader);

  override getNotifications(
    hospitalId: number,
    status: NotificationStatus,
    cursor: string | null,
    limit = 10,
  ): Observable<NotificationPage> {
    // Lista real (`getNotifications` é x-implemented): comunicados internos vindos do backend.
    const page$ = super.getNotifications(hospitalId, status, cursor, limit);

    // Mensagens que o profissional enviou a partir do Hub (FR-010): entram na primeira página, no estado
    // compartilhado da thread (ativa/resolvida) — o mesmo registro que o card do Hub mostra. Ainda sem backend.
    return forkJoin([page$, from(this.messages.listBySender(this.profile.read().name))]).pipe(
      map(([base, sent]) => {
        const mine = sent
          .filter(thread => (thread.resolved ? 'resolved' : 'pending') === status)
          .map(sentThreadToNotification)
          .reverse();

        return cursor === null ? { ...base, items: [...mine, ...base.items] } : base;
      }),
    );
  }

  override createReply(notificationId: number, text: string): Observable<NotificationReply> {
    if (notificationId < 0) {
      // Thread enviada pelo Hub: ainda sem backend; a resposta segue o registro provisório do Hub.
      return of(this.repository.addReply(notificationId, text));
    }

    // `createNotificationReply` é x-implemented no contrato: chamada real.
    return super.createReply(notificationId, text);
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

    // `resolveNotification` é x-implemented no contrato: chamada real.
    return super.resolve(notificationId);
  }
}
