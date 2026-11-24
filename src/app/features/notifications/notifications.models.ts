// Espelham openapi/notifications-api.yaml. Mesmo padrão manual usado em
// features/home/home.models.ts (stand-in para o client gerado por `pnpm models`,
// ver nota em data-access/notifications-api.service.ts).

export interface ProfessionalRef {
  id: number;
  name: string;
  specialty: string;
  photoUrl: string | null;
}

export interface PatientRef {
  id: number;
  name: string;
}

export interface NotificationReply {
  id: number;
  author: ProfessionalRef;
  text: string;
  createdAt: string;
}

/** Tipo do item da lista (FT-005-1 exibidos aqui + comunicado interno da FT-005-2). */
export type NotificationType = 'patient_message' | 'reevaluation_pending' | 'internal_notice';

export interface Notification {
  id: number;
  author: ProfessionalRef;
  type?: NotificationType;
  /** Ausente no comunicado interno (`type = internal_notice`). */
  patient: PatientRef | null;
  /** Pendência de reavaliação vencida (indicador definido na FT-005-1). */
  overdue?: boolean;
  description: string;
  createdAt: string;
  read: boolean;
  replyCount: number;
  replies: NotificationReply[];
}

export type NotificationStatus = 'pending' | 'resolved';

export interface NotificationPage {
  items: Notification[];
  nextCursor: string | null;
  /** Total de não lidas do profissional (os dois tipos), independente de status/cursor. */
  unreadCount: number;
}
