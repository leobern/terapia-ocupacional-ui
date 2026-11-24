import { Injectable, type Signal, signal } from '@angular/core';

import {
  type HospitalLinkStatus,
  type HospitalRef,
  type Notification,
  type NotificationPage,
  type NotificationReply,
  type NotificationStatus,
  type PatientRef,
  type ProfessionalRef,
} from '../notifications.models';

/** Dados de um comunicado interno (assistente central): sempre com destinatários. */
export interface NewNotification {
  readonly recipients: readonly ProfessionalRef[];
  readonly message: string;
  /** Data limite (`yyyy-MM-dd`); ausente ou vazio = sem prazo (comunicado interno não tem). */
  readonly dueDate?: string;
  /** Paciente vinculado (mensagens do Hub, FT-005-1); ausente = comunicado sem paciente. */
  readonly patient?: PatientRef;
}

interface StoredNotification {
  readonly status: NotificationStatus;
  readonly notification: Notification;
}

const ME: ProfessionalRef = { id: 4, name: 'Michelle Franklin', photoUrl: null, specialty: 'Nutróloga' };
const RAFAEL: ProfessionalRef = { id: 1, name: 'Rafael Dutra Rabello Euarte', photoUrl: null, specialty: 'Nutrólogo' };
const FILIPPA: ProfessionalRef = { id: 2, name: 'Filippa Martins', photoUrl: null, specialty: 'Nutricionista' };
const JAIRO: ProfessionalRef = { id: 3, name: 'Jairo Nepomuceno', photoUrl: null, specialty: 'Enfermeiro' };

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

function seed(): StoredNotification[] {
  const base = (
    id: number,
    author: ProfessionalRef,
    patient: string | null,
    description: string,
    minutes: number,
    replies: NotificationReply[] = [],
  ): Notification => ({
    author,
    createdAt: minutesAgo(minutes),
    description,
    id,
    patient: patient ? { id, name: patient } : null,
    read: false,
    replies,
    replyCount: replies.length,
    type: 'patient_message',
  });
  const reply = (id: number, text: string): NotificationReply => ({
    author: ME,
    createdAt: minutesAgo(5),
    id,
    text,
  });

  const notice = (id: number, author: ProfessionalRef, description: string, minutes: number): Notification => ({
    ...base(id, author, null, description, minutes),
    type: 'internal_notice',
  });
  const reevaluation = (
    id: number,
    patient: string,
    description: string,
    minutes: number,
    overdue: boolean,
  ): Notification => ({
    ...base(id, FILIPPA, patient, description, minutes),
    overdue,
    type: 'reevaluation_pending',
  });

  // US-001-2-03: avisos do sistema (sem autor nem paciente) sobre o vínculo do médico com um hospital.
  const linkChange = (
    id: number,
    hospital: HospitalRef,
    linkStatus: HospitalLinkStatus,
    description: string,
    minutes: number,
  ): Notification => ({
    createdAt: minutesAgo(minutes),
    description,
    hospital,
    id,
    linkStatus,
    read: false,
    replies: [],
    replyCount: 0,
    type: 'hospital_link_status_change',
  });

  return [
    {
      notification: linkChange(
        31,
        { id: 1, name: 'Hospital Vila Nova Star' },
        'approved',
        'Você foi aprovado no Hospital Vila Nova Star.',
        5,
      ),
      status: 'pending',
    },
    {
      notification: linkChange(
        32,
        { id: 2, name: 'Hospital Santa Aurora' },
        'rejected',
        'Sua solicitação ao Hospital Santa Aurora foi recusada.',
        8,
      ),
      status: 'pending',
    },
    {
      notification: linkChange(
        33,
        { id: 3, name: 'Hospital São Gabriel' },
        'revoked',
        'Seu acesso ao Hospital São Gabriel foi revogado.',
        12,
      ),
      status: 'pending',
    },
    { notification: notice(14, RAFAEL, 'Reunião de equipe amanhã às 8h na sala 3.', 10), status: 'pending' },
    {
      notification: reevaluation(15, 'Almira Borges Pereira', 'Reavaliação nutricional vencida há 2 dias.', 30, true),
      status: 'pending',
    },
    {
      notification: reevaluation(16, 'Samuel Lima Rocha', 'Reavaliação nutricional prevista para amanhã.', 50, false),
      status: 'pending',
    },
    {
      notification: { ...notice(25, JAIRO, 'Checklist de segurança atualizado.', 200), replies: [], replyCount: 1 },
      status: 'resolved',
    },
    {
      notification: base(
        11,
        RAFAEL,
        'Almira Borges Pereira',
        'Estoque com vencimento próximo: Disponíveis 8 unidades de Fresubin Protein Drink – Baunilha (cód. 81751) com vencimento em julho/2026.',
        20,
      ),
      status: 'pending',
    },
    {
      notification: base(
        12,
        FILIPPA,
        'Samuel Lima Rocha',
        'Paciente em uso de GTT, internado devido à erisipela. Aguarda início de TNE',
        45,
        [reply(1, 'Vou acompanhar.'), reply(2, 'Prescrição ajustada.')],
      ),
      status: 'pending',
    },
    {
      notification: base(13, JAIRO, 'José da Silva', 'Identificada exteriorização acidental da SNE.', 70, [
        reply(3, 'Reposicionada.'),
      ]),
      status: 'pending',
    },
    {
      notification: base(21, JAIRO, 'José da Silva', 'Identificada exteriorização acidental da SNE.', 300, [
        reply(4, 'Resolvido com a equipe.'),
      ]),
      status: 'resolved',
    },
    {
      notification: base(22, FILIPPA, 'José da Silva', 'Identificada exteriorização acidental da SNE.', 360, [
        reply(5, 'Resolvido.'),
      ]),
      status: 'resolved',
    },
    {
      notification: base(23, RAFAEL, 'José da Silva', 'Identificada exteriorização acidental da SNE.', 420, [
        reply(6, 'Ok.'),
      ]),
      status: 'resolved',
    },
    {
      notification: base(24, JAIRO, 'José da Silva', 'Identificada exteriorização acidental da SNE.', 480, [
        reply(7, 'Ok.'),
      ]),
      status: 'resolved',
    },
  ];
}

/**
 * Armazenamento PROVISÓRIO (em memória) das notificações enquanto não existe a API: guarda
 * os dados de exemplo, pagina por cursor e recebe as notificações criadas pelo formulário.
 * Os dados somem ao recarregar a página. `version` muda a cada alteração — a tela de
 * Notificações a observa para recarregar a lista.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsRepository {
  readonly version: Signal<number>;

  private readonly versionSignal = signal(0);
  private items: StoredNotification[] = seed();
  private nextId = 100;

  constructor() {
    this.version = this.versionSignal.asReadonly();
  }

  /** Página (por cursor = índice do próximo item) das notificações de um status, da mais recente para a mais antiga. */
  list(status: NotificationStatus, cursor: string | null, limit: number): NotificationPage & { totalCount: number } {
    const all = this.items
      .filter(item => item.status === status)
      .map(item => item.notification)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id);
    const start = cursor ? Number(cursor) : 0;
    const end = Math.min(start + limit, all.length);

    return {
      items: all.slice(start, end),
      nextCursor: end < all.length ? String(end) : null,
      totalCount: all.length,
    };
  }

  /** Total de notificações não lidas (ativas e resolvidas) — o selo do sino da Home. */
  countUnread(): number {
    return this.items.filter(item => !item.notification.read).length;
  }

  /**
   * Marca como lidas as notificações informadas. Não altera `version`: ler não muda o que a
   * lista mostra (o estado local já reflete) e recarregar a cada leitura geraria laço.
   */
  markAsRead(notificationIds: readonly number[]): void {
    this.items = this.items.map(item =>
      notificationIds.includes(item.notification.id) && !item.notification.read
        ? { ...item, notification: { ...item.notification, read: true } }
        : item,
    );
  }

  /** Cria um comunicado interno ATIVO (pendente) do profissional autenticado. */
  create(input: NewNotification): Notification {
    const notification: Notification = {
      author: ME,
      createdAt: new Date().toISOString(),
      description: input.message,
      id: this.nextId++,
      patient: input.patient ?? null,
      read: false,
      recipients: input.recipients.map(recipient => ({ ...recipient })),
      replies: [],
      replyCount: 0,
      type: 'internal_notice',
    };

    this.items = [...this.items, { notification, status: 'pending' }];
    this.versionSignal.update(version => version + 1);

    return notification;
  }

  addReply(notificationId: number, text: string): NotificationReply {
    const reply: NotificationReply = { author: ME, createdAt: new Date().toISOString(), id: this.nextId++, text };

    this.items = this.items.map(item =>
      item.notification.id === notificationId
        ? {
            ...item,
            notification: {
              ...item.notification,
              replies: [...item.notification.replies, reply],
              replyCount: item.notification.replyCount + 1,
            },
          }
        : item,
    );
    this.versionSignal.update(version => version + 1);

    return reply;
  }

  /** Move a notificação para "resolvida" (botão ✓ do card). */
  resolve(notificationId: number): void {
    this.items = this.items.map(item =>
      item.notification.id === notificationId ? { ...item, status: 'resolved' } : item,
    );
    this.versionSignal.update(version => version + 1);
  }
}
