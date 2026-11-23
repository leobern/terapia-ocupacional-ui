import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { map, Observable } from 'rxjs';

import { Notification, NotificationPage, NotificationReply, NotificationStatus } from '../notifications.models';

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

  /**
   * Cria um comunicado interno (sem paciente) do profissional autenticado para as pessoas
   * informadas (`POST /api/v1/notifications/announcements`). O registro em trilha imutável é do backend.
   */
  createAnnouncement(hospitalId: number, content: string, recipientIds: readonly number[]): Observable<Notification> {
    return this.http.post<Notification>(`${this.baseUrl}/announcements`, { content, hospitalId, recipientIds });
  }

  /** Marca a notificação como resolvida (botão ✓ do card — Figma v2/NotificationThread). */
  resolve(notificationId: number): Observable<void> {
    return this.http.post<undefined>(`${this.baseUrl}/${notificationId}/resolve`, {}).pipe(map(() => undefined));
  }
}
