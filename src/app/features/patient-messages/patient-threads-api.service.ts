import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { NotificationsApiService } from '../notifications/data-access/notifications-api.service';
import { asPatientApiId } from '../patient-hub/messages/patient-api-id';
import { MessageThread, ThreadReplyRequest, ThreadResolveRequest } from './patient-messages.models';
import { PatientMessagesSource, PatientMessagesWriter } from './patient-messages-source';

interface ProfessionalRefDto {
  readonly id: number;
  readonly name: string;
  readonly specialty: string;
}

export interface RecipientSpecDto {
  readonly type: 'PESSOA' | 'GRUPO' | 'TODOS';
  readonly professionalId?: number;
  readonly perfil?: string;
}

interface ReplyDto {
  readonly id: number;
  readonly author: ProfessionalRefDto;
  readonly text: string;
  readonly createdAt: string;
}

/** `MensagemThread` de openapi/mensagens-api.yaml. */
export interface MensagemThreadDto {
  readonly id: number;
  readonly type: 'patient_message' | 'reevaluation_pending';
  readonly status: 'pending' | 'resolved';
  readonly author?: ProfessionalRefDto;
  readonly description: string;
  readonly createdAt: string;
  readonly overdue: boolean;
  readonly resolvedAt?: string | null;
  readonly dueAt?: string | null;
  readonly recipients?: readonly RecipientSpecDto[];
  readonly replyCount: number;
  readonly replies: readonly ReplyDto[];
}

interface MensagemThreadPageDto {
  readonly items: readonly MensagemThreadDto[];
  readonly nextCursor: string | null;
}

/** Tamanho do lote (máximo do contrato) e teto de lotes por carga, para nunca paginar sem fim. */
const PAGE_SIZE = 10;
const MAX_PAGES = 20;

function recipientLabels(dto: MensagemThreadDto): readonly string[] {
  const known = new Map<number, string>();

  for (const person of [dto.author, ...dto.replies.map(r => r.author)]) {
    if (person !== undefined) {
      known.set(person.id, person.name);
    }
  }

  return (dto.recipients ?? []).flatMap(spec => {
    if (spec.type === 'TODOS') {
      return ['@todos'];
    }
    if (spec.type === 'GRUPO') {
      return spec.perfil ? [`@${spec.perfil}`] : [];
    }
    const name = spec.professionalId === undefined ? undefined : known.get(spec.professionalId);

    // O contrato só manda o id da pessoa; sem nome conhecido, omite em vez de inventar.
    return name === undefined ? [] : [`@${name}`];
  });
}

/**
 * Converte a thread do contrato no modelo da tela. Sem equivalente no contrato: `patientName` (a tela já
 * sabe o paciente), a origem da resposta (`origin`, sempre texto) e o autor da resolução (`statusChanges`
 * traz só a data de `resolvedAt`; a reabertura não é histórico no backend, só volta a `pending`).
 */
export function toMessageThread(dto: MensagemThreadDto, patientId: string): MessageThread {
  return {
    at: dto.createdAt,
    author: dto.author?.name ?? '',
    deadline: dto.dueAt ?? null,
    id: String(dto.id),
    patientId,
    patientName: '',
    recipients: recipientLabels(dto),
    replies: dto.replies.map(r => ({
      at: r.createdAt,
      author: r.author.name,
      id: String(r.id),
      origin: 'text',
      text: r.text,
    })),
    resolved: dto.status === 'resolved',
    statusChanges:
      dto.status === 'resolved' && dto.resolvedAt ? [{ at: dto.resolvedAt, author: '', kind: 'resolved' }] : [],
    text: dto.description,
  };
}

/**
 * Threads do paciente via API real (openapi/mensagens-api.yaml): `GET .../mensagens` (`listarMensagensPaciente`),
 * `POST .../mensagens/{mensagemId}/respostas` (`responderMensagemPaciente`) e, para resolver, o registro único
 * compartilhado com as notificações (`POST /api/v1/notifications/{id}/resolve`, `resolveNotification`).
 * A lista vem em lotes de 10 por cursor (uma chamada por lote, nunca uma por thread). Erros HTTP chegam
 * como `HttpErrorResponse` rejeitado e a tela mostra o aviso.
 */
@Injectable()
export class PatientThreadsApiService extends PatientMessagesSource implements PatientMessagesWriter {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsApiService);
  /** Últimas threads carregadas: `resolve` só devolve a notificação e o card precisa da thread atualizada. */
  private readonly known = new Map<string, MessageThread>();

  async list(patientId: string): Promise<readonly MessageThread[]> {
    const url = this.url(patientId);
    const threads: MessageThread[] = [];
    let cursor: string | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      let params = new HttpParams().set('limit', PAGE_SIZE);

      if (cursor !== null) {
        params = params.set('cursor', cursor);
      }
      // Cursor: o próximo lote só se conhece depois do anterior, então a espera em sequência é intencional.
      // eslint-disable-next-line no-await-in-loop
      const body: MensagemThreadPageDto = await firstValueFrom(this.http.get<MensagemThreadPageDto>(url, { params }));

      threads.push(...body.items.map(item => this.remember(toMessageThread(item, patientId))));
      cursor = body.nextCursor;
      if (cursor === null) {
        break;
      }
    }

    // O backend manda da mais recente para a mais antiga; a porta promete da mais antiga à mais nova.
    return threads.reverse();
  }

  async reply(request: ThreadReplyRequest): Promise<MessageThread> {
    const body = await firstValueFrom(
      this.http.post<MensagemThreadDto>(`${this.url(request.patientId)}/${request.threadId}/respostas`, {
        text: request.text,
      }),
    );

    return this.remember(toMessageThread(body, request.patientId));
  }

  async resolve(request: ThreadResolveRequest): Promise<MessageThread> {
    const current = this.known.get(request.threadId);

    await firstValueFrom(this.notifications.resolve(Number(request.threadId)));
    if (current === undefined) {
      throw new Error('thread não carregada');
    }
    if (current.resolved) {
      return current;
    }

    return this.remember({
      ...current,
      resolved: true,
      statusChanges: [...current.statusChanges, { at: request.at, author: request.author, kind: 'resolved' }],
    });
  }

  private url(patientId: string): string {
    return `${environment.apiBaseUrl}/v1/pacientes/${asPatientApiId(patientId)}/mensagens`;
  }

  private remember(thread: MessageThread): MessageThread {
    this.known.set(thread.id, thread);

    return thread;
  }
}
