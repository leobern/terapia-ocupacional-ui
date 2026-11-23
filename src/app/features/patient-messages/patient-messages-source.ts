import { MessageThread, ThreadReplyRequest } from './patient-messages.models';

/** Porta de leitura das threads do paciente. Sem contrato de API: a real substitui a provisória. */
export abstract class PatientMessagesSource {
  /** Todas as threads vinculadas ao paciente (qualquer vinculado aprovado vê todas), da mais antiga à mais nova. */
  abstract list(patientId: string): Promise<readonly MessageThread[]>;
  /** Threads enviadas por um autor, de todos os pacientes (alimenta a lista de notificações do remetente). */
  abstract listBySender(author: string): Promise<readonly MessageThread[]>;
}

/**
 * Porta de gravação da resposta: trilha imutável (Princípio V). Reabre a thread resolvida e registra a
 * reabertura. Rejeita quando a gravação falha (nada é gravado); exige conexão. Devolve a thread atualizada.
 */
export abstract class PatientMessagesWriter {
  abstract reply(request: ThreadReplyRequest): Promise<MessageThread>;
}

/** Porta de transcrição do áudio da resposta (IA fora de escopo). Devolve '' se nada foi reconhecido; rejeita se falhar. */
export abstract class ReplyTranscriber {
  abstract transcribe(audio: Blob): Promise<string>;
}
