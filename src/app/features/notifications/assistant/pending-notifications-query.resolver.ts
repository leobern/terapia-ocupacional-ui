import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  type AssistantAnswer,
  type AssistantQueryResolver,
  normalizeQuestion,
} from '../../../shared/services/assistant-query-resolver';
import { HospitalContextService } from '../../home/hospital-context.service';
import { NotificationsApiService } from '../data-access/notifications-api.service';
import { type Notification, type NotificationPage } from '../notifications.models';

/** Limite de segurança de páginas lidas ao montar o resumo. */
const MAX_PAGES = 10;

/**
 * Consulta de leitura "pendências do dia" (RN-01 da US-003-4-04): resume as notificações
 * PENDENTES (mesmo critério da tela de Notificações) do profissional autenticado no hospital em
 * contexto, da mais recente para a mais antiga. A pergunta sobre pacientes fora da meta
 * nutricional (RN-02) não é tratada aqui: depende da listagem de pacientes ainda não especificada.
 */
@Injectable()
export class PendingNotificationsQueryResolver implements AssistantQueryResolver {
  private readonly api = inject(NotificationsApiService);
  private readonly hospitalContext = inject(HospitalContextService);

  matches(question: string): boolean {
    return normalizeQuestion(question).includes('pendencias');
  }

  async resolve(): Promise<AssistantAnswer> {
    const hospitalId = Number(this.hospitalContext.selected()?.id);
    const notifications: Notification[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      // Paginação por cursor: cada página depende do cursor da anterior.
      // eslint-disable-next-line no-await-in-loop
      const result: NotificationPage = await firstValueFrom(this.api.getNotifications(hospitalId, 'pending', cursor));

      notifications.push(...result.items);
      cursor = result.nextCursor;
      if (!cursor) {
        break;
      }
    }

    if (notifications.length === 0) {
      return { summary: 'Você não tem pendências.' };
    }

    return {
      items: notifications.map(n => `${n.author.name} (${n.author.specialty}): ${n.description}`),
      summary: notifications.length === 1 ? 'Você tem 1 pendência:' : `Você tem ${notifications.length} pendências:`,
    };
  }
}
