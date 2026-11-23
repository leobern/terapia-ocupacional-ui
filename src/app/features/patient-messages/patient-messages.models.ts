/** Origem do texto de uma resposta: digitado ou transcrito de áudio (FR-009). */
export type ReplyOrigin = 'text' | 'audio';

/** Resposta de uma thread: imutável, sem edição nem exclusão (Princípio V). */
export interface ThreadReply {
  readonly at: string;
  readonly author: string;
  readonly id: string;
  readonly origin: ReplyOrigin;
  readonly text: string;
}

/** Mudança de estado da thread, registrada com autor e data/hora (FR-014). */
export interface ThreadStatusChange {
  readonly at: string;
  readonly author: string;
  readonly kind: 'resolved' | 'reopened';
}

/** Thread de mensagem vinculada a um paciente (registro do Hub com destinatário). */
export interface MessageThread {
  readonly at: string;
  readonly author: string;
  /** Prazo de reavaliação (ISO); `null` quando não é uma pendência com prazo. */
  readonly deadline: string | null;
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string;
  /** Destinatários como exibidos: "@nome", "@medicos", "@todos". */
  readonly recipients: readonly string[];
  readonly replies: readonly ThreadReply[];
  readonly resolved: boolean;
  readonly statusChanges: readonly ThreadStatusChange[];
  readonly text: string;
}

export interface ThreadReplyRequest {
  readonly at: string;
  readonly author: string;
  readonly origin: ReplyOrigin;
  readonly text: string;
  readonly threadId: string;
}

export const THREADS_LOAD_FAILED_HINT = 'Não foi possível carregar as mensagens. Tente novamente.';
export const THREADS_EMPTY_TEXT = 'Nenhuma mensagem registrada para este paciente.';
export const REPLY_FAILED_HINT = 'Não foi possível enviar a resposta. O texto foi mantido; tente novamente.';
export const REPLY_OFFLINE_HINT = 'Sem conexão: responder fica indisponível até a conexão voltar.';
export const REPLY_AUDIO_FAILED_HINT = 'Não foi possível transcrever o áudio. Digite a resposta manualmente.';
export const REPLY_AUDIO_EMPTY_HINT = 'Nenhum texto foi identificado no áudio. Digite a resposta manualmente.';
export const REPLY_MIC_DENIED_HINT = 'Sem acesso ao microfone. Digite a resposta ou permita o microfone.';
export const REPLY_MIC_FAILED_HINT = 'Não foi possível gravar o áudio. Digite a resposta manualmente.';

const pad = (n: number): string => String(n).padStart(2, '0');

/** `dd/MM/yyyy HH:mm` no fuso local. */
export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);

  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Pendência com prazo já passado e ainda não resolvida (FR-014f): só indicador visual. */
export const isOverdue = (thread: MessageThread, now: Date): boolean =>
  !thread.resolved && thread.deadline !== null && new Date(thread.deadline).getTime() < now.getTime();
