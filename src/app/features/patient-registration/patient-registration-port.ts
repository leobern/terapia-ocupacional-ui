export type PatientSex = 'MALE' | 'FEMALE' | 'NOT_INFORMED';

/** Dados fixos do paciente (glossário FT-002-1): nome, nascimento (`yyyy-MM-dd`), sexo e SAME opcional. */
export interface NewPatient {
  readonly fullName: string;
  readonly birthDate: string;
  readonly sex: PatientSex;
  readonly medicalRecordNumber?: string | null;
}

/** Schema `Paciente` do contrato (`openapi/pacientes-api.yaml`). */
export interface RegisteredPatient {
  readonly id: string;
  readonly hospitalId: number;
  readonly fullName: string;
  readonly birthDate: string;
  readonly sex: PatientSex;
  readonly medicalRecordNumber?: string | null;
}

/** Desfecho do cadastro: criado, ou bloqueado por SAME já usado no hospital (RN-01/RN-02), com o nome do dono (RN-03). */
export type PatientRegistrationResult =
  | { readonly kind: 'created'; readonly patient: RegisteredPatient }
  | { readonly kind: 'same-duplicate'; readonly medicalRecordNumber: string; readonly existingPatientName: string };

export abstract class PatientRegistrationPort {
  /** Rejeita (HttpErrorResponse) nos demais erros: 400, 401, 403, 404, 422, rede e 409 sem `SAME_DUPLICADO`. */
  abstract create(hospitalId: number, patient: NewPatient): Promise<PatientRegistrationResult>;
}
