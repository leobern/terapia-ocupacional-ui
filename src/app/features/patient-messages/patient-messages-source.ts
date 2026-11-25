import { MessageThread, ThreadReplyRequest, ThreadResolveRequest } from './patient-messages.models';

/** Porta de leitura das threads do paciente (GET /api/v1/pacientes/{pacienteId}/mensagens, openapi/mensagens-api.yaml). */
export abstract class PatientMessagesSource {
  /** Todas as threads vinculadas ao paciente (qualquer vinculado aprovado vê todas), da mais antiga à mais nova. */
  abstract list(patientId: string): Promise<readonly MessageThread[]>;
}

/**
 * Porta de gravação da resposta: trilha imutável (Princípio V). Reabre a thread resolvida e registra a
 * reabertura. Rejeita quando a gravação falha (nada é gravado); exige conexão. Devolve a thread atualizada.
 */
export abstract class PatientMessagesWriter {
  abstract reply(request: ThreadReplyRequest): Promise<MessageThread>;
  /**
   * Marca a thread como resolvida e registra autor e data/hora (FR-014). É o registro único lido pelo card do
   * Hub e pela lista de notificações. Rejeita quando a gravação falha (a thread continua ativa); exige conexão.
   */
  abstract resolve(request: ThreadResolveRequest): Promise<MessageThread>;
}

/** Porta de transcrição do áudio da resposta (IA fora de escopo). Devolve '' se nada foi reconhecido; rejeita se falhar. */
export abstract class ReplyTranscriber {
  abstract transcribe(audio: Blob): Promise<string>;
}
