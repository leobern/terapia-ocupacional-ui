import { Notification, ProfessionalRef } from '../notifications/notifications.models';
import { MessageThread } from './patient-messages.models';

const ref = (name: string): ProfessionalRef => ({ id: 0, name, photoUrl: null, specialty: '' });

/** Estado em texto para o remetente acompanhar a mensagem (resposta e ativa/resolvida), além da cor. */
export const sentThreadStatusText = (thread: MessageThread): string => {
  const replies = thread.replies.length;
  const noun = replies === 1 ? 'resposta' : 'respostas';
  const answered = replies === 0 ? 'sem resposta' : `${replies} ${noun}`;

  return `${thread.resolved ? 'Resolvida' : 'Ativa'} · ${answered}`;
};

/**
 * Entrada da lista pessoal de notificações do remetente para uma mensagem enviada no Hub (FR-010). O estado
 * vem da própria thread (registro único compartilhado com o card do Hub). O id é negativo para não colidir
 * com o das notificações do repositório.
 */
export const sentThreadToNotification = (thread: MessageThread): Notification => ({
  author: ref(thread.author),
  createdAt: thread.at,
  description: `${sentThreadStatusText(thread)} — ${thread.text}`,
  id: -Number(thread.id.replace(/\D/g, '')),
  patient: { id: thread.patientId, name: thread.patientName },
  read: true,
  replies: thread.replies.map((r, i) => ({ author: ref(r.author), createdAt: r.at, id: i, text: r.text })),
  replyCount: thread.replies.length,
  type: 'patient_message',
});

/** Notificação gerada a partir de uma thread enviada pelo próprio profissional (id negativo). */
export const isSentThreadNotification = (notification: Notification): boolean => notification.id < 0;
