import { Injectable } from '@angular/core';

import { normalizeName } from './normalize-name';
import { PatientMatch } from './patient-duplicate.models';
import { PatientDuplicateSource } from './patient-duplicate-source';

interface StoredPatient extends PatientMatch {
  readonly hospitalId: number;
}

/** Fonte em memória só para testes: em produção a porta é atendida por `PatientDuplicateApiService` (app.config). */
@Injectable()
export class ProvisionalPatientDuplicateSource extends PatientDuplicateSource {
  private readonly patients: readonly StoredPatient[] = [
    { birthDate: '1990-07-02', fullName: 'João Pedro Lima', hospitalId: 1, id: 1, medicalRecordNumber: '12345' },
    { birthDate: '1960-01-10', fullName: 'José Antônio', hospitalId: 1, id: 2, medicalRecordNumber: null },
    { birthDate: '1978-05-20', fullName: 'Ana Clara Ferreira', hospitalId: 2, id: 3, medicalRecordNumber: '777' },
  ];

  find(
    hospitalId: number,
    fullName: string,
    birthDate: string,
    medicalRecordNumber?: string | null,
  ): Promise<readonly PatientMatch[]> {
    const key = normalizeName(fullName);
    const same = medicalRecordNumber?.trim();

    return Promise.resolve(
      this.patients
        // Mesmo SAME preenchido nos dois lados não é coincidência (US-002-1-03 RN-01).
        .filter(p => p.hospitalId === hospitalId && p.birthDate === birthDate && normalizeName(p.fullName) === key)
        .filter(p => !same || !p.medicalRecordNumber || p.medicalRecordNumber !== same)
        .map(({ birthDate: date, fullName: name, id, medicalRecordNumber: existingSame }) => ({
          birthDate: date,
          fullName: name,
          id,
          medicalRecordNumber: existingSame,
        })),
    );
  }
}
