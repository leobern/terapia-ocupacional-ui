import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PatientDuplicateApiService } from './patient-duplicate-api.service';
import { PatientDuplicateError } from './patient-duplicate-error';

describe('PatientDuplicateApiService', () => {
  let service: PatientDuplicateApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PatientDuplicateApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PatientDuplicateApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const call = (): Promise<unknown> => service.find(7, 'José Antônio', '1960-01-10');
  const failureOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
    promise.then(
      () => undefined,
      (e: unknown) => (e as PatientDuplicateError).failure,
    );

  it('envia hospital, nome e data ISO e converte a lista (SAME nulo = não preenchido)', async () => {
    const result = call();
    const req = http.expectOne(r => r.url === '/api/v1/pacientes/duplicidade');

    expect(req.request.params.get('hospitalId')).toBe('7');
    expect(req.request.params.get('fullNameQuery')).toBe('José Antônio');
    expect(req.request.params.get('birthDateQuery')).toBe('1960-01-10');
    req.flush({
      matches: [
        { birthDate: '1960-01-10', fullName: 'José Antônio', id: 1, medicalRecordNumber: '55' },
        { birthDate: '1960-01-10', fullName: 'Jose Antonio', id: 2 },
      ],
    });

    expect(await result).toEqual([
      { birthDate: '1960-01-10', fullName: 'José Antônio', medicalRecordNumber: '55' },
      { birthDate: '1960-01-10', fullName: 'Jose Antonio', medicalRecordNumber: null },
    ]);
  });

  it('lista vazia resulta em array vazio', async () => {
    const result = call();

    http.expectOne(r => r.url === '/api/v1/pacientes/duplicidade').flush({ matches: [] });

    expect(await result).toEqual([]);
  });

  const cases: [string, number, object | null, string][] = [
    ['422 MSG-01', 422, { message: 'Digite pelo menos 3 caracteres para buscar.' }, 'invalid-name'],
    ['422 MSG-02', 422, { message: 'Informe uma data de nascimento válida.' }, 'invalid-date'],
    ['422 sem corpo', 422, null, 'invalid-date'],
    ['403', 403, { message: 'x' }, 'access-denied'],
    ['401', 401, { message: 'x' }, 'session-expired'],
    ['400', 400, { message: 'x' }, 'unavailable'],
    ['500', 500, { message: 'x' }, 'unavailable'],
  ];

  for (const [name, status, body, expected] of cases) {
    it(`classifica ${name} como ${expected}`, async () => {
      const result = failureOf(call());

      http.expectOne(r => r.url === '/api/v1/pacientes/duplicidade').flush(body, { status, statusText: 'x' });

      expect(await result).toBe(expected);
    });
  }

  it('classifica erro de rede como unavailable', async () => {
    const result = failureOf(call());

    http.expectOne(r => r.url === '/api/v1/pacientes/duplicidade').error(new ProgressEvent('error'));

    expect(await result).toBe('unavailable');
  });
});
