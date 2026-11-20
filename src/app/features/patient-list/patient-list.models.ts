/** Tipo de terapia nutricional exibido em texto no card (FR-003). */
export type TherapyType = 'VO' | 'NE' | 'NP' | 'MISTA';

/** Situação do paciente no hospital, conforme o censo (EP-002). */
export type AdmissionStatus = 'ADMITTED_BY_EMTN' | 'NOT_ADMITTED';

/** Adequação da prescrição ativa (FT-004-8): `null` em um dos campos = ausente na prescrição. */
export interface Adequacy {
  readonly caloric: number | null;
  readonly protein: number | null;
}

/** Registro do censo hospitalar: inclui quem NÃO é da EMTN (FR-002 filtra na montagem). */
export interface CensusPatient {
  readonly id: string;
  readonly hospitalId: string;
  readonly name: string;
  readonly birthDate: string;
  readonly ward: string;
  readonly bed: string;
  readonly therapy: TherapyType;
  readonly registeredInConductia: boolean;
  readonly admissionStatus: AdmissionStatus;
  /** Data (AAAA-MM-DD) de início da terapia nutricional, do acompanhamento do paciente. */
  readonly therapyStartDate: string;
  /** Adequação espelhada da prescrição ativa; `null` quando não há prescrição ativa. */
  readonly adequacy: Adequacy | null;
  /** Ciclos triagem→avaliação→diagnóstico→plano concluídos. */
  readonly completedCycles: number;
  /**
   * Data (AAAA-MM-DD) de efeito de um encerramento de acompanhamento confirmado na FT-004-9 (FR-031).
   * Ausente = acompanhamento ativo. Só leitura: esta tela nunca grava.
   */
  readonly followUpEndDate?: string;
}

/** Projeção somente leitura "paciente em visão de card" (sem data de nascimento — FR-003). */
export interface PatientCard {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly ward: string;
  readonly bed: string;
  readonly therapy: TherapyType;
  /** Dias desde o início da terapia nutricional até a data selecionada (FR-003). */
  readonly therapyDays: number;
  /** Espelho da prescrição ativa, sem recálculo (FR-004). */
  readonly adequacy: Adequacy | null;
  /** FR-005: nenhum ciclo concluído ainda. */
  readonly firstEvaluation: boolean;
}
