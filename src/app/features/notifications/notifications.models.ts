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
  id: number;
  name: string;
}

export interface NotificationReply {
  id: number;
  author: ProfessionalRef;
  text: string;
  createdAt: string;
}

export interface Notification {
  id: number;
  author: ProfessionalRef;
  patient: PatientRef;
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
  /** Contagem total (não paginada) daquele status — convergence T053. */
  totalCount: number;
}
