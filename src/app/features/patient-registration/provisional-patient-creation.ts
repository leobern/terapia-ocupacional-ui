import { Injectable } from '@angular/core';

import { type CreatedPatient, type CreatePatientRequest, PatientCreationPort } from './patient-creation.port';

/** Fonte provisória (sem API ainda): apenas devolve sucesso, sem persistir nada. */
@Injectable()
export class ProvisionalPatientCreation extends PatientCreationPort {
  private nextId = 1;

  create(request: CreatePatientRequest): Promise<CreatedPatient> {
    return Promise.resolve({
      createdAt: new Date().toISOString(),
      fullName: request.fullName,
      hospitalId: request.hospitalId,
      id: this.nextId++,
      birthDate: request.birthDate,
      medicalRecordNumber: request.medicalRecordNumber ?? null,
      sex: request.sex,
    });
  }
}
