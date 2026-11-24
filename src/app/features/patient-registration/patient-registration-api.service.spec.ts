import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PatientRegistrationApiService } from './patient-registration-api.service';

const URL = '/api/v1/hospitais/7/pacientes';
const NEW_PATIENT = {
  birthDate: '1950-03-02',
  fullName: 'Antônio Ferreira Dias',
  medicalRecordNumber: 'SAME-4521',
  sex: 'MALE',
} as const;
const DUPLICATE = {
  code: 'SAME_DUPLICADO',
  existingPatientName: 'Rita de Cássia Nunes',
  medicalRecordNumber: 'SAME-4521',
  message: 'x',
  timestamp: '2026-11-24T10:00:00Z',
};

describe('PatientRegistrationApiService', () => {
  let service: PatientRegistrationApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PatientRegistrationApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PatientRegistrationApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envia os campos fixos ao hospital e devolve o paciente criado em 201', async () => {
    const result = service.create(7, NEW_PATIENT);
    const req = http.expectOne({ method: 'POST', url: URL });

    expect(req.request.body).toEqual(NEW_PATIENT);
    const created = { ...NEW_PATIENT, hospitalId: 7, id: 'abc' };

    req.flush(created, { status: 201, statusText: 'Created' });

    expect(await result).toEqual({ kind: 'created', patient: created });
  });

  it('409 SAME_DUPLICADO vira resultado tipado com o nome do paciente existente (RN-01/RN-02/RN-03)', async () => {
    const result = service.create(7, NEW_PATIENT);

    http.expectOne(URL).flush(DUPLICATE, { status: 409, statusText: 'Conflict' });

    expect(await result).toEqual({
      existingPatientName: 'Rita de Cássia Nunes',
      kind: 'same-duplicate',
      medicalRecordNumber: 'SAME-4521',
    });
  });

  it('409 sem o código esperado não é confundido com SAME duplicado', async () => {
    const result = service.create(7, NEW_PATIENT);

    http.expectOne(URL).flush({ code: 'OUTRO', message: 'x' }, { status: 409, statusText: 'Conflict' });

    await expectAsync(result).toBeRejected();
  });

  it('409 sem corpo não é confundido com SAME duplicado', async () => {
    const result = service.create(7, NEW_PATIENT);

    http.expectOne(URL).flush(null, { status: 409, statusText: 'Conflict' });

    await expectAsync(result).toBeRejected();
  });

  for (const status of [400, 401, 403, 404, 422, 500]) {
    it(`${status} rejeita com o erro HTTP`, async () => {
      const result = service.create(7, NEW_PATIENT);

      http.expectOne(URL).flush({ message: 'x' }, { status, statusText: 'Erro' });

      await expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ status }));
    });
  }

  it('falha de rede rejeita', async () => {
    const result = service.create(7, NEW_PATIENT);

    http.expectOne(URL).error(new ProgressEvent('error'));

    await expectAsync(result).toBeRejected();
  });
});
