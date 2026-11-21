import {
  FollowUpClosure,
  FollowUpClosureRequest,
  FollowUpReopening,
  FollowUpReopeningRequest,
} from './follow-up-closure.models';

/** Porta de leitura do histórico de encerramentos. Sem contrato de API: a real substitui a provisória. */
export abstract class FollowUpClosureSource {
  /** Todos os encerramentos do paciente, do mais antigo ao mais recente. */
  abstract list(patientId: string): Promise<readonly FollowUpClosure[]>;
  /** Encerramentos de todos os pacientes (alimenta o censo). */
  abstract listAll(): Promise<readonly FollowUpClosure[]>;
  /** Reaberturas do paciente, da mais antiga à mais recente. */
  abstract listReopenings(patientId: string): Promise<readonly FollowUpReopening[]>;
  /** Reaberturas de todos os pacientes (o censo ignora os encerramentos revertidos). */
  abstract listAllReopenings(): Promise<readonly FollowUpReopening[]>;
}

/**
 * Porta de gravação: trilha de auditoria imutável (Princípio V). Sem edição nem exclusão. Rejeita quando a
 * gravação falha (nada é gravado) e exige conexão.
 */
export abstract class FollowUpClosureWriter {
  abstract close(request: FollowUpClosureRequest): Promise<FollowUpClosure>;
  /** Só acrescenta a reabertura: o encerramento original não é alterado nem apagado (FR-012). */
  abstract reopen(request: FollowUpReopeningRequest): Promise<FollowUpReopening>;
}
