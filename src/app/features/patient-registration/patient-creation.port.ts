import { type PatientSex } from './patient-registration.rules';

export interface CreatePatientRequest {
  /** Hospital ativo na sessão: o paciente fica vinculado exclusivamente a ele (RN-04). */
  readonly hospitalId: number;
  readonly fullName: string;
  /** `aaaa-mm-dd`. */
  readonly birthDate: string;
  readonly sex: PatientSex;
  readonly medicalRecordNumber?: string;
}

export interface CreatedPatient {
  readonly id: number;
  readonly hospitalId: number;
  readonly fullName: string;
  readonly birthDate: string;
  readonly sex: PatientSex;
  readonly medicalRecordNumber: string | null;
  readonly createdAt: string;
}

/** Campos que o servidor pode rejeitar com 422. */
export type PatientField = 'fullName' | 'birthDate' | 'sex';

/** Validação rejeitada pelo servidor: `field` indica a pergunta a repetir e `message` (se houver) o texto a exibir. */
export class PatientFieldError extends Error {
  constructor(
    readonly field: PatientField,
    readonly code: string,
    message = '',
  ) {
    super(message);
  }
}

/**
 * Fronteira de criação do paciente (registro mestre do hospital). Rejeita com `PatientFieldError`
 * quando o servidor recusa um campo; qualquer outro erro é falha genérica.
 */
export abstract class PatientCreationPort {
  abstract create(request: CreatePatientRequest): Promise<CreatedPatient>;
}
