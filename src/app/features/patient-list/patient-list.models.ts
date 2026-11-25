import { ReviewCadence } from '../patient-hub/plan/review-cadence';

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
  readonly hospitalId: number;
  readonly name: string;
  readonly birthDate: string;
  readonly ward: string;
  readonly bed: string;
  /** `null` = o backend ainda não informa a terapia (paciente real): a tela mostra "Não informada". */
  readonly therapy: TherapyType | null;
  readonly registeredInConductia: boolean;
  readonly admissionStatus: AdmissionStatus;
  /** Data (AAAA-MM-DD) de início da terapia nutricional; `null` = não informada na internação. */
  readonly therapyStartDate: string | null;
  /** Adequação espelhada da prescrição ativa; `null` quando não há prescrição ativa. */
  readonly adequacy: Adequacy | null;
  /** Ciclos triagem→avaliação→diagnóstico→plano concluídos; `null` = desconhecido (nunca vira "primeira avaliação"). */
  readonly completedCycles: number | null;
  /**
   * Data (AAAA-MM-DD) de efeito de um encerramento de acompanhamento confirmado na FT-004-9 (FR-031).
   * Ausente = acompanhamento ativo. Só leitura: esta tela nunca grava.
   */
  readonly followUpEndDate?: string;

  /**
   * Pendências da data selecionada ainda abertas (triagem, reavaliação, revisão de prescrição).
   * Ausente = não informado: o paciente segue como ativo. Alta/óbito/transferência não entram aqui (FR-016).
   */
  readonly pendingTasks?: number;

  /**
   * Cadência da próxima revisão definida no Plano de Intervenção (FT-004-6), só leitura.
   * Ausente = sem cadência gravada: vale a diária.
   */
  readonly reviewCadence?: ReviewCadence;

  /** A reavaliação da data selecionada já foi concluída. Ausente = ainda aberta. */
  readonly reassessmentDone?: boolean;
}

/** Projeção somente leitura "paciente em visão de card" (FR-003). */
export interface PatientCard {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  /** Data de nascimento (AAAA-MM-DD), mostrada junto da idade na tabela (Figma 4690:24100). */
  readonly birthDate: string;
  readonly ward: string;
  readonly bed: string;
  readonly therapy: TherapyType | null;
  /** Dias desde o início da terapia nutricional até a data selecionada (FR-003); `null` = início não informado. */
  readonly therapyDays: number | null;
  /** Espelho da prescrição ativa, sem recálculo (FR-004). */
  readonly adequacy: Adequacy | null;
  /** FR-005: nenhum ciclo concluído ainda. */
  readonly firstEvaluation: boolean;
  /** FR-016: todas as pendências da data concluídas; segue na lista, em cinza. */
  readonly finished: boolean;
  /** FT-004-6: a data cai na cadência de revisão do Plano e a reavaliação ainda está aberta. */
  readonly reassessmentDue: boolean;
}
