import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';

import { PacientesApiService } from './pacientes-api.service';
import { PatientFieldError } from './patient-creation.port';

describe('PacientesApiService', () => {
  let service: PacientesApiService;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/v1/pacientes`;
  const request = { birthDate: '1975-09-15', fullName: 'Carlos', hospitalId: 7, sex: 'MALE' } as const;
  const created = {
    ...request,
    createdAt: '2026-11-24T12:00:00Z',
    id: 1,
    medicalRecordNumber: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PacientesApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PacientesApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('201: posts the body with the active hospital and returns the created patient', async () => {
    const result = service.create(request);
    const req = http.expectOne(url);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(created, { status: 201, statusText: 'Created' });

    await expectAsync(result).toBeResolvedTo(created);
  });

  for (const field of ['fullName', 'birthDate', 'sex'] as const) {
    it(`422 with field ${field} rejects with PatientFieldError`, async () => {
      const result = service.create(request);

      http
        .expectOne(url)
        .flush({ code: 'MSG-0X', field, message: 'texto', timestamp: 'x' }, { status: 422, statusText: 'err' });

      await expectAsync(result).toBeRejectedWith(new PatientFieldError(field, 'MSG-0X', 'texto'));
    });
  }

  it('422 without a known field keeps the HTTP error', async () => {
    const result = service.create(request);

    http.expectOne(url).flush({ message: 'x' }, { status: 422, statusText: 'err' });

    await expectAsync(result).toBeRejectedWith(jasmine.any(HttpErrorResponse));
  });

  it('422 with an empty body keeps the HTTP error', async () => {
    const result = service.create(request);

    http.expectOne(url).flush(null, { status: 422, statusText: 'err' });

    await expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ status: 422 }));
  });

  it('422 with a field but no code/message fills defaults', async () => {
    const result = service.create(request);

    http.expectOne(url).flush({ field: 'sex' }, { status: 422, statusText: 'err' });

    await expectAsync(result).toBeRejectedWith(new PatientFieldError('sex', '', ''));
  });

  it('409 MSG-07 (SAME em uso) volta à pergunta do SAME com o texto do servidor', async () => {
    const result = service.create(request);
    const message = 'Este número de SAME já está em uso por outro paciente neste hospital: Maria.';

    http.expectOne(url).flush({ code: 'MSG-07', message }, { status: 409, statusText: 'err' });

    await expectAsync(result).toBeRejectedWith(new PatientFieldError('medicalRecordNumber', 'MSG-07', message));
  });

  it('409 sem MSG-07 mantém o erro HTTP', async () => {
    const result = service.create(request);

    http.expectOne(url).flush({ message: 'x' }, { status: 409, statusText: 'err' });

    await expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ status: 409 }));
  });

  for (const status of [400, 401, 403, 0]) {
    it(`${status}: rejects with the HTTP error`, async () => {
      const result = service.create(request);

      http.expectOne(url).flush({ message: 'x' }, { status, statusText: 'err' });

      await expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ status }));
    });
  }
});
