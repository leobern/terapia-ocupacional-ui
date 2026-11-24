import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { map, Observable } from 'rxjs';

import { NotificationPage, NotificationReply, NotificationStatus } from '../notifications.models';

/**
 * Cliente HTTP de `openapi/notifications-api.yaml`: `GET /api/v1/notifications`,
 * `POST .../{id}/replies`, `PUT .../{id}/read` e `POST .../{id}/resolve`.
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

  /** Marca a notificação como resolvida (botão ✓ do card — Figma v2/NotificationThread). Idempotente. */
  resolve(notificationId: number): Observable<void> {
    return this.http.post<unknown>(`${this.baseUrl}/${notificationId}/resolve`, {}).pipe(map(() => undefined));
  }

  /** Marca a notificação como lida para o profissional autenticado (idempotente, 204). */
  markAsRead(notificationId: number): Observable<void> {
    return this.http.put<unknown>(`${this.baseUrl}/${notificationId}/read`, {}).pipe(map(() => undefined));
  }
}
