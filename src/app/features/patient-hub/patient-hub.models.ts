import { TherapyType } from '../patient-list/patient-list.models';

/** Identificação do paciente exibida no cabeçalho do Hub (Figma 4608:4375). */
export interface PatientHubProfile {
  readonly id: string;
  readonly name: string;
  readonly ward: string;
  readonly bed: string;
  /** AAAA-MM-DD */
  readonly birthDate: string;
  /** `null` = terapia não informada (paciente real: o backend ainda não fornece). */
  readonly therapy: TherapyType | null;
  /** AAAA-MM-DD: início da terapia nutricional; `null` = não informado na internação. */
  readonly therapyStartDate: string | null;
}

/** Origem do texto gravado: alimenta a trilha de auditoria feita no backend (Princípio V). */
export type HypothesisOrigin = 'ai' | 'ai-edited' | 'manual';

/** Contrato de gravação da Hipótese/Diagnóstico: autor e data/hora seguem para a trilha de auditoria. */
export interface HypothesisSaveRequest {
  readonly patientId: string;
  readonly text: string;
  readonly origin: HypothesisOrigin;
  readonly author: string;
  /** ISO 8601 */
  readonly at: string;
}
