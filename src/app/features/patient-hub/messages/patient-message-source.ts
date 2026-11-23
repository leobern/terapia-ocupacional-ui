import { LinkedProfessional, PatientRecord, PatientRecordRequest, ProfessionalGroup } from './patient-message.models';

/**
 * Porta de leitura e gravação dos registros do Hub (FT-005-1). Sem contrato de API: a implementação real
 * substitui a provisória em `app.config.ts`; a trilha de auditoria imutável e o envio das notificações
 * aos destinatários são feitos no backend. Não há edição nem exclusão. Rejeita em caso de falha.
 */
export abstract class PatientMessageSource {
  /** Mais recente primeiro. Offline, a implementação real devolve o último cache local. */
  abstract list(patientId: string): Promise<readonly PatientRecord[]>;
  abstract send(request: PatientRecordRequest): Promise<PatientRecord>;
}

/** Porta dos profissionais vinculados e aprovados ao paciente (base da resolução de grupos e @todos). */
export abstract class PatientTeamSource {
  abstract listLinked(patientId: string): Promise<readonly LinkedProfessional[]>;
}

/**
 * Porta do assistente de IA (fora de escopo: só entrada/saída). Rejeitar significa "IA indisponível";
 * nada do que ele devolve é enviado sem confirmação explícita do profissional.
 */
export abstract class MessageAiAssistant {
  /** Texto transcrito do áudio ('' quando nada foi reconhecido). */
  abstract transcribe(audio: Blob): Promise<string>;
  /** Grupos prováveis a partir do conteúdo relatado, quando nenhum destinatário foi mencionado. */
  abstract suggestGroups(content: string): Promise<readonly ProfessionalGroup[]>;
}
