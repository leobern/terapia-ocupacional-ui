import { HypothesisSaveRequest, PatientHubProfile } from './patient-hub.models';

/**
 * Porta de leitura do Hub do paciente. Sem contrato de API: a implementação real (EP-002/FT-004-2)
 * substitui a provisória em `app.config.ts`. Offline, a implementação real devolve o último cache local
 * (a Hipótese já preenchida continua visível sem conexão).
 */
export abstract class PatientHubSource {
  /** `null` = paciente inexistente. */
  abstract loadProfile(patientId: string): Promise<PatientHubProfile | null>;
  /** `null` = Hipótese/Diagnóstico ainda não preenchida. */
  abstract loadHypothesis(patientId: string): Promise<string | null>;
}

/**
 * Porta do serviço de síntese de IA (fora de escopo: só o contrato de entrada/saída).
 * Rejeita quando o serviço falha ou está indisponível.
 */
export abstract class HypothesisSynthesizer {
  abstract synthesize(pastedText: string): Promise<string>;
}

/** Porta de gravação da Hipótese/Diagnóstico; a trilha de auditoria é feita no backend. */
export abstract class HypothesisWriter {
  abstract save(request: HypothesisSaveRequest): Promise<void>;
}

/**
 * Porta de leitura da existência de internação anterior do paciente no MESMO hospital
 * (mesmo paciente cadastrado E mesma unidade hospitalar). Sem contrato de API real; offline, a
 * implementação real só responde se a informação estiver local. Rejeita quando não consegue consultar.
 */
export abstract class PriorStaysSource {
  abstract hasPriorStays(patientId: string, hospitalId: string): Promise<boolean>;
}

/**
 * Porta do serviço de IA que sintetiza condutas e intercorrências de terapia nutricional das internações
 * anteriores (fora de escopo: só entrada/saída). Texto livre; rejeita se falhar ou estiver indisponível.
 */
export abstract class PriorStaysSynthesizer {
  abstract synthesize(patientId: string, hospitalId: string): Promise<string>;
}
