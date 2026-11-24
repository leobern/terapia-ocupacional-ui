import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { NotificationsApiService } from '../notifications/data-access/notifications-api.service';
import { HospitalContextService } from './hospital-context.service';
import { LinkedHospitalsReader } from './linked-hospitals';
import { UnreadNotificationsReader } from './unread-notifications-reader';

/**
 * Selo de não lidas do sino a partir da API real: `GET /api/v1/notifications` devolve `unreadCount`
 * (mensagens/pendências de paciente + comunicados, independe de status/cursor). Lê a cada chamada,
 * então o selo reflete o que o profissional leu, respondeu ou resolveu assim que a tela é reaberta.
 * Sem hospital vinculado ou com falha, o selo some (0), sem derrubar a tela.
 */
@Injectable()
export class ApiUnreadNotificationsReader extends UnreadNotificationsReader {
  private readonly api = inject(NotificationsApiService);
  private readonly context = inject(HospitalContextService);
  private readonly hospitals = inject(LinkedHospitalsReader);

  async countUnread(): Promise<number> {
    try {
      const hospitalId = this.context.selected()?.id ?? (await this.hospitals.read()).at(0)?.id;

      if (hospitalId === undefined) {
        return 0;
      }
      // Só o `unreadCount` interessa: um item basta para a API devolver a página.
      const page = await firstValueFrom(this.api.getNotifications(hospitalId, 'pending', null, 1));

      return page.unreadCount ?? 0;
    } catch {
      return 0;
    }
  }
}
