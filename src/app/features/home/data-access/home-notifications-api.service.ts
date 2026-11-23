import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { NotificationPage } from '../home.models';
import { HomeNotificationsSource } from '../home-notifications-source';
import { HomeApiService } from './home-api.service';

/**
 * Feed da Home via API real (`GET /api/v1/home/notifications`, openapi/home-api.yaml).
 * Erros do contrato (400/401/403) chegam como `HttpErrorResponse` rejeitado; a Home os trata como falha de carga.
 */
@Injectable()
export class HomeNotificationsApiService extends HomeNotificationsSource {
  private readonly api = inject(HomeApiService);

  loadPage(hospitalId: number, cursor: string | null, limit: number): Promise<NotificationPage> {
    return firstValueFrom(this.api.getNotifications(Number(hospitalId), cursor, limit));
  }
}
