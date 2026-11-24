import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';

import { InternacaoFieldError } from './internacao-creation.port';
import { InternacoesApiService } from './internacoes-api.service';

describe('InternacoesApiService', () => {
  let service: InternacoesApiService;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/v1/pacientes/5/internacoes`;
  const created = {
    admissionNumber: null,
    bedNumber: '302B',
    createdAt: '2026-11-24T12:00:00Z',
    healthInsurance: null,
    hospitalAdmissionDate: null,
    id: 1,
    locations: [],
    nutritionalTherapyStartDate: null,
    pacienteId: 5,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InternacoesApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InternacoesApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('201: sends only the filled fields and returns the created internação', async () => {
    const result = service.create(5, { bedNumber: '302B', healthInsurance: '' });
    const req = http.expectOne(url);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ bedNumber: '302B' });
    req.flush(created, { status: 201, statusText: 'Created' });

    await expectAsync(result).toBeResolvedTo(created);
  });

  it('sends an empty body when nothing was answered (RN-01)', async () => {
    const result = service.create(5, {});
    const req = http.expectOne(url);

    expect(req.request.body).toEqual({});
    req.flush(created, { status: 201, statusText: 'Created' });

    await expectAsync(result).toBeResolved();
  });

  it('422 MSG-08 on hospitalAdmissionDate rejects with InternacaoFieldError carrying the server text', async () => {
    const result = service.create(5, { hospitalAdmissionDate: '2999-01-01' });

    http
      .expectOne(url)
      .flush(
        { code: 'MSG-08', field: 'hospitalAdmissionDate', message: 'texto', timestamp: 'x' },
        { status: 422, statusText: 'err' },
      );

    await expectAsync(result).toBeRejectedWith(new InternacaoFieldError('hospitalAdmissionDate', 'MSG-08', 'texto'));
  });

  const one = { locationType: 'UNIDADE', locationValue: 'UTI' } as const;
  const two = { locationType: 'ALA', locationValue: 'Ala Norte' } as const;

  for (const [count, locations, expected] of [
    [0, [], {}],
    [1, [one], { locations: [one] }],
    [2, [one, two], { locations: [one, two] }],
  ] as const) {
    it(`sends ${count} location(s) (empty list is omitted) and returns them`, async () => {
      const result = service.create(5, { locations });
      const req = http.expectOne(url);

      expect(req.request.body).toEqual(expected);
      req.flush({ ...created, locations }, { status: 201, statusText: 'Created' });

      expect((await result).locations).toEqual(locations);
    });
  }

  for (const code of ['MSG-09', 'MSG-10']) {
    it(`422 ${code} on locations rejects with InternacaoFieldError`, async () => {
      const result = service.create(5, { locations: [{ locationType: 'ALA', locationValue: ' ' }] });

      http.expectOne(url).flush({ code, field: 'locations', message: 'texto' }, { status: 422, statusText: 'err' });

      await expectAsync(result).toBeRejectedWith(new InternacaoFieldError('locations', code, 'texto'));
    });
  }

  it('422 with an unknown field or without body is passed through', async () => {
    const unknown = service.create(5, {});

    http.expectOne(url).flush({ field: 'x' }, { status: 422, statusText: 'err' });
    await expectAsync(unknown).toBeRejectedWith(jasmine.any(HttpErrorResponse));

    const empty = service.create(5, {});

    http.expectOne(url).flush(null, { status: 422, statusText: 'err' });
    await expectAsync(empty).toBeRejectedWith(jasmine.any(HttpErrorResponse));
  });

  it('422 without code or message falls back to empty strings', async () => {
    const result = service.create(5, {});

    http.expectOne(url).flush({ field: 'hospitalAdmissionDate' }, { status: 422, statusText: 'err' });

    await expectAsync(result).toBeRejectedWith(new InternacaoFieldError('hospitalAdmissionDate', '', ''));
  });

  for (const status of [400, 401, 403, 404, 500]) {
    it(`${status} is passed through as the original HTTP error`, async () => {
      const result = service.create(5, {});

      http.expectOne(url).flush({ message: 'x' }, { status, statusText: 'err' });

      await expectAsync(result).toBeRejectedWith(jasmine.any(HttpErrorResponse));
    });
  }
});
