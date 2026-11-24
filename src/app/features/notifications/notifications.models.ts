// Espelham specs/004-notificacoes/contracts/notifications-api.yaml. Mesmo padrão
// manual usado em features/home/home.models.ts (stand-in para o client gerado por
// `pnpm models`, ver nota em data-access/notifications-api.service.ts).

export interface ProfessionalRef {
  id: number;
  name: string;
  specialty: string;
  photoUrl: string | null;
}

export interface PatientRef {
  /** Número nas notificações antigas; o id do paciente (texto) quando vem de uma mensagem do Hub. */
  id: number | string;
  name: string;
}

export interface NotificationReply {
  id: number;
  author: ProfessionalRef;
  text: string;
  createdAt: string;
}

export type NotificationType = 'patient_message' | 'reevaluation_pending' | 'internal_notice';

export interface Notification {
  id: number;
  type: NotificationType;
  /** Pendência de reavaliação vencida (indicador da FT-005-1). */
  overdue?: boolean;
  author: ProfessionalRef;
  /** Ausente em comunicados internos e nas notificações criadas pelo formulário. */
  patient?: PatientRef | null;
  description: string;
  createdAt: string;
  read: boolean;
  /** Destinatários mencionados (pessoa, ou grupo já resolvido para pessoas) — define quem participa da thread. */
  mentioned?: ProfessionalRef[];
  replyCount: number;
  replies: NotificationReply[];
  /** Destinatários de um comunicado interno (sem paciente); ausente nas mensagens de paciente. */
  recipients?: ProfessionalRef[];
}

export type NotificationStatus = 'pending' | 'resolved';

export interface NotificationPage {
  items: Notification[];
  nextCursor: string | null;
  /** Não lidas do profissional (os dois tipos), independente de status/cursor. */
  unreadCount?: number;
  /** Contagem total daquele status — só a fonte provisória informa; o contrato não a define. */
  totalCount?: number;
}
