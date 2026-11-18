import { inject, Injectable } from '@angular/core';

import { NotificationsRepository } from '../notifications/data-access/notifications-repository.service';
import { NotificationPage } from './home.models';
import { HomeNotificationsSource } from './home-notifications-source';

/**
 * Provisório: o feed da Home mostra as notificações PENDENTES do mesmo repositório em memória
 * que a tela de Notificações usa — o que se cria lá aparece aqui. Substituído pela API real.
 */
@Injectable()
export class ProvisionalHomeNotificationsSource extends HomeNotificationsSource {
  private readonly repository = inject(NotificationsRepository);

  loadPage(_?: string, cursor?: string | null, limit = 10): Promise<NotificationPage> {
    const page = this.repository.list('pending', cursor ?? null, limit);

    return Promise.resolve({
      items: page.items.map(({ author, createdAt, description, id, read }) => ({
        author,
        createdAt,
        description,
        id,
        read,
      })),
      nextCursor: page.nextCursor,
    });
  }
}
