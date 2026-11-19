/** Tipo de terapia nutricional exibido em texto no card (FR-003). */
export type TherapyType = 'VO' | 'NE' | 'NP' | 'MISTA';

/** Situação do paciente no hospital, conforme o censo (EP-002). */
export type AdmissionStatus = 'ADMITTED_BY_EMTN' | 'NOT_ADMITTED';

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
}

/** Projeção somente leitura "paciente em visão de card" (sem data de nascimento — FR-003). */
export interface PatientCard {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly ward: string;
  readonly bed: string;
  readonly therapy: TherapyType;
}
