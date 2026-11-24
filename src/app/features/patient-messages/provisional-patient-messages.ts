import { Injectable } from '@angular/core';

import { MessageThread, ThreadReplyRequest, ThreadResolveRequest } from './patient-messages.models';
import { PatientMessagesSource, PatientMessagesWriter, ReplyTranscriber } from './patient-messages-source';

const SEED: readonly MessageThread[] = [
  {
    at: '2026-11-20T14:30:00.000Z',
    author: 'Dra. Helena Prado',
    deadline: null,
    id: 'thread-1',
    patientId: 'p1',
    patientName: 'Lucas Henrique Pimentel',
    recipients: ['@nutris'],
    replies: [],
    resolved: false,
    statusChanges: [],
    text: 'Paciente com resíduo gástrico elevado; avaliar redução da velocidade da dieta.',
  },
  {
    at: '2026-11-19T10:00:00.000Z',
    author: 'Michelle Franklin',
    deadline: '2026-11-21T10:00:00.000Z',
    id: 'thread-2',
    patientId: 'p1',
    patientName: 'Lucas Henrique Pimentel',
    recipients: ['@todos'],
    replies: [],
    resolved: false,
    statusChanges: [],
    text: 'Reavaliar tolerância à NE após ajuste de velocidade.',
  },
];

/** Provisório: guarda as threads em memória (só acrescenta respostas e mudanças de estado). */
@Injectable()
export class ProvisionalPatientMessages extends PatientMessagesSource implements PatientMessagesWriter {
  private threads: readonly MessageThread[] = SEED;
  private sequence = 0;

  list(patientId: string): Promise<readonly MessageThread[]> {
    return Promise.resolve(this.threads.filter(t => t.patientId === patientId));
  }

  listBySender(author: string): Promise<readonly MessageThread[]> {
    return Promise.resolve(this.threads.filter(t => t.author === author));
  }

  reply(request: ThreadReplyRequest): Promise<MessageThread> {
    const current = this.threads.find(t => t.id === request.threadId);

    if (current === undefined) {
      return Promise.reject(new Error('thread inexistente'));
    }
    const updated: MessageThread = {
      ...current,
      replies: [
        ...current.replies,
        {
          at: request.at,
          author: request.author,
          id: `reply-${++this.sequence}`,
          origin: request.origin,
          text: request.text,
        },
      ],
      resolved: false,
      statusChanges: current.resolved
        ? [...current.statusChanges, { at: request.at, author: request.author, kind: 'reopened' }]
        : current.statusChanges,
    };

    this.threads = this.threads.map(t => (t.id === updated.id ? updated : t));

    return Promise.resolve(updated);
  }

  resolve(request: ThreadResolveRequest): Promise<MessageThread> {
    const current = this.threads.find(t => t.id === request.threadId);

    if (current === undefined) {
      return Promise.reject(new Error('thread inexistente'));
    }
    if (current.resolved) {
      return Promise.resolve(current);
    }
    const updated: MessageThread = {
      ...current,
      resolved: true,
      statusChanges: [...current.statusChanges, { at: request.at, author: request.author, kind: 'resolved' }],
    };

    this.threads = this.threads.map(t => (t.id === updated.id ? updated : t));

    return Promise.resolve(updated);
  }
}

/** Provisório: ainda não há serviço de transcrição; não reconhece texto (segue o campo manual). */
@Injectable()
export class ProvisionalReplyTranscriber extends ReplyTranscriber {
  transcribe(): Promise<string> {
    return Promise.resolve('');
  }
}
