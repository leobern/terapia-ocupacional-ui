import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';

import { BedNotIdentifiedError, PatientWithoutInternacaoError } from './bed-movement.port';
import { BedMovementApiService } from './bed-movement-api.service';

describe('BedMovementApiService', () => {
  let service: BedMovementApiService;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/v1/pacientes/5/internacoes/movimentacao-leito/resolver`;
  const resolved = { currentBedNumber: '302B', internacaoId: 9, newBedNumber: '412', pacienteId: 5 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BedMovementApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BedMovementApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('200: sends the extracted bed and returns the resolved movement', async () => {
    const result = service.resolve(5, ' 412 ');
    const req = http.expectOne(url);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ newBedNumber: '412' });
    req.flush(resolved);

    await expectAsync(result).toBeResolvedTo(resolved);
  });

  it('does not send a missing or blank bed', async () => {
    const missing = service.resolve(5);

    http
      .expectOne(url)
      .flush({ code: 'MSG-12', field: 'newBedNumber', message: 'x' }, { status: 422, statusText: 'U' });
    await expectAsync(missing).toBeRejected();

    const blank = service.resolve(5, '  ');
    const req = http.expectOne(url);

    expect(req.request.body).toEqual({});
    req.flush({ code: 'MSG-12', message: 'x' }, { status: 422, statusText: 'U' });
    await expectAsync(blank).toBeRejectedWithError(BedNotIdentifiedError);
  });

  it('422 MSG-11 becomes PatientWithoutInternacaoError with the server message', async () => {
    const result = service.resolve(5, '412');

    http.expectOne(url).flush({ code: 'MSG-11', message: 'sem internação' }, { status: 422, statusText: 'U' });

    await expectAsync(result).toBeRejectedWith(new PatientWithoutInternacaoError('sem internação'));
  });

  it('422 MSG-11 without message falls back to an empty message', async () => {
    const result = service.resolve(5, '412');

    http.expectOne(url).flush({ code: 'MSG-11' }, { status: 422, statusText: 'U' });

    await expectAsync(result).toBeRejectedWithError(PatientWithoutInternacaoError, '');
  });

  it('422 MSG-12 becomes BedNotIdentifiedError on newBedNumber', async () => {
    const result = service.resolve(5);

    http
      .expectOne(url)
      .flush({ code: 'MSG-12', field: 'newBedNumber', message: 'sem leito' }, { status: 422, statusText: 'U' });

    await expectAsync(result).toBeRejectedWith(new BedNotIdentifiedError('newBedNumber', 'sem leito'));
  });

  it('422 MSG-12 without field or message uses defaults', async () => {
    const result = service.resolve(5);

    http.expectOne(url).flush({ code: 'MSG-12' }, { status: 422, statusText: 'U' });

    const error = (await result.catch((e: unknown) => e)) as BedNotIdentifiedError;

    expect(error.field).toBe('newBedNumber');
    expect(error.message).toBe('');
  });

  it('passes through other 422s and other HTTP errors unchanged', async () => {
    const other = service.resolve(5, '1');

    http.expectOne(url).flush({ code: 'X' }, { status: 422, statusText: 'U' });
    await expectAsync(other).toBeRejectedWith(jasmine.any(HttpErrorResponse));

    const nullBody = service.resolve(5, '1');

    http.expectOne(url).flush(null, { status: 422, statusText: 'U' });
    await expectAsync(nullBody).toBeRejectedWith(jasmine.any(HttpErrorResponse));

    const statuses = [400, 401, 403, 404, 500];
    const results = statuses.map(status => {
      const result = service.resolve(5, '1');

      http.expectOne(url).flush({ message: 'x' }, { status, statusText: 'E' });

      return result.catch((e: unknown) => (e as HttpErrorResponse).status);
    });

    expect(await Promise.all(results)).toEqual(statuses);
  });
});
