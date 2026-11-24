import { Injectable } from '@angular/core';

import { normalizeName } from './normalize-name';
import { PatientMatch } from './patient-duplicate.models';
import { PatientDuplicateSource } from './patient-duplicate-source';

interface StoredPatient extends PatientMatch {
  readonly hospitalId: number;
}

/** Provisório (sem backend): pacientes de exemplo em memória; troca pelo serviço HTTP no ticket seguinte. */
@Injectable()
export class ProvisionalPatientDuplicateSource extends PatientDuplicateSource {
  private readonly patients: readonly StoredPatient[] = [
    { birthDate: '1990-07-02', fullName: 'João Pedro Lima', hospitalId: 1, medicalRecordNumber: '12345' },
    { birthDate: '1960-01-10', fullName: 'José Antônio', hospitalId: 1, medicalRecordNumber: null },
    { birthDate: '1978-05-20', fullName: 'Ana Clara Ferreira', hospitalId: 2, medicalRecordNumber: '777' },
  ];

  find(hospitalId: number, fullName: string, birthDate: string): Promise<readonly PatientMatch[]> {
    const key = normalizeName(fullName);

    return Promise.resolve(
      this.patients
        .filter(p => p.hospitalId === hospitalId && p.birthDate === birthDate && normalizeName(p.fullName) === key)
        .map(({ birthDate: date, fullName: name, medicalRecordNumber }) => ({
          birthDate: date,
          fullName: name,
          medicalRecordNumber,
        })),
    );
  }
}
