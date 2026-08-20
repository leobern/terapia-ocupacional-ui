import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

import { NotificationPage, NotificationReply, NotificationStatus } from '../notifications.models';

/**
 * Cliente HTTP para `GET /api/v1/notifications` e
 * `POST /api/v1/notifications/{id}/replies`
 * (specs/004-notificacoes/contracts/notifications-api.yaml).
 *
 * Mesmo padrão de `features/home/data-access/home-api.service.ts`: escrito à
 * mão em vez de gerado por `pnpm models` (ver nota lá) — mantenha em
 * sincronia com o YAML se preferir manter este serviço.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/notifications`;

  getNotifications(
    hospitalId: number,
    status: NotificationStatus,
    cursor: string | null,
    limit = 10,
  ): Observable<NotificationPage> {
    let params = new HttpParams().set('hospitalId', hospitalId).set('status', status).set('limit', limit);

    if (cursor) {
      params = params.set('cursor', cursor);
    }

    return this.http.get<NotificationPage>(this.baseUrl, { params });
  }

  createReply(notificationId: number, text: string): Observable<NotificationReply> {
    return this.http.post<NotificationReply>(`${this.baseUrl}/${notificationId}/replies`, { text });
  }
}
