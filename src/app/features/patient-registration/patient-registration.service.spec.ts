import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { I18nService } from '../../shared/services/i18n.service';
import { FormSubmitError } from '../../shared/services/screen-actions.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { PatientRegistrationService } from './patient-registration.service';
import { NewPatient, PatientRegistrationPort, PatientRegistrationResult } from './patient-registration-port';

const PATIENT: NewPatient = {
  birthDate: '1950-03-02',
  fullName: 'Antônio Ferreira Dias',
  medicalRecordNumber: 'SAME-4521',
  sex: 'MALE',
};
const MSG_07 = (): string =>
  TestBed.inject(I18nService).t('patientRegistration.msg07').replace('{name}', 'Rita de Cássia Nunes');

describe('PatientRegistrationService', () => {
  let result: PatientRegistrationResult;
  let create: jasmine.Spy;
  const selected = signal<{ id: number } | null>({ id: 7 });

  beforeEach(() => {
    selected.set({ id: 7 });
    result = { kind: 'same-duplicate', existingPatientName: 'Rita de Cássia Nunes', medicalRecordNumber: 'SAME-4521' };
    create = jasmine.createSpy('create').and.callFake(() => Promise.resolve(result));
    TestBed.configureTestingModule({
      providers: [
        { provide: PatientRegistrationPort, useValue: { create } },
        { provide: HospitalContextService, useValue: { selected } },
      ],
    });
  });

  it('cenários 1 e 3: SAME duplicado bloqueia com MSG-07 contendo o nome do paciente existente', async () => {
    const error = await TestBed.inject(PatientRegistrationService)
      .register({ ...PATIENT, fullName: 'Rita de Cássia Nunes' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FormSubmitError);
    expect((error as Error).message).toBe(MSG_07());
    expect(create).toHaveBeenCalledWith(7, jasmine.objectContaining({ medicalRecordNumber: 'SAME-4521' }));
  });

  it('cenário 2: nome diferente com o mesmo SAME também bloqueia com MSG-07', async () => {
    await expectAsync(TestBed.inject(PatientRegistrationService).register(PATIENT)).toBeRejectedWithError(
      FormSubmitError,
      MSG_07(),
    );
  });

  it('após o bloqueio, nova tentativa sem SAME conclui o cadastro', async () => {
    const service = TestBed.inject(PatientRegistrationService);

    await expectAsync(service.register(PATIENT)).toBeRejected();
    const created = { ...PATIENT, hospitalId: 7, id: 'abc', medicalRecordNumber: null };

    result = { kind: 'created', patient: created };

    expect(await service.register({ ...PATIENT, medicalRecordNumber: null })).toEqual(created);
  });

  it('sem hospital selecionado não chama a API', async () => {
    selected.set(null);

    await expectAsync(TestBed.inject(PatientRegistrationService).register(PATIENT)).toBeRejectedWithError(
      FormSubmitError,
      TestBed.inject(I18nService).t('patientRegistration.noHospital'),
    );

    expect(create).not.toHaveBeenCalled();
  });
});
