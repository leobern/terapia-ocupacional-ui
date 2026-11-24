import { PatientMatch } from './patient-duplicate.models';

/**
 * Porta da verificação de duplicidade (US-002-1-01). Considera só pacientes do hospital informado;
 * o nome é comparado sem acentuação e caixa e a data de forma exata. Com `medicalRecordNumber`, um paciente com o
 * mesmo SAME preenchido não é coincidência (US-002-1-03 RN-01).
 */
export abstract class PatientDuplicateSource {
  /** `birthDate` em ISO `yyyy-MM-dd`. Falhas inesperadas são propagadas como erro. */
  abstract find(
    hospitalId: number,
    fullName: string,
    birthDate: string,
    medicalRecordNumber?: string | null,
  ): Promise<readonly PatientMatch[]>;
}
