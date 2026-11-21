import { FollowUpClosure, FollowUpClosureRequest } from './follow-up-closure.models';

/** Porta de leitura do histórico de encerramentos. Sem contrato de API: a real substitui a provisória. */
export abstract class FollowUpClosureSource {
  /** Todos os encerramentos do paciente, do mais antigo ao mais recente. */
  abstract list(patientId: string): Promise<readonly FollowUpClosure[]>;
  /** Encerramentos de todos os pacientes (alimenta o censo). */
  abstract listAll(): Promise<readonly FollowUpClosure[]>;
}

/**
 * Porta de gravação: trilha de auditoria imutável (Princípio V). Sem edição nem exclusão. Rejeita quando a
 * gravação falha (nada é gravado) e exige conexão.
 */
export abstract class FollowUpClosureWriter {
  abstract close(request: FollowUpClosureRequest): Promise<FollowUpClosure>;
}
