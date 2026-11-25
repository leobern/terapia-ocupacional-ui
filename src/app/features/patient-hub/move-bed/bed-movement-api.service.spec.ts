import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';

import { BedNotIdentifiedError, PatientNotFoundError, PatientWithoutInternacaoError } from './bed-movement.port';
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

  describe('confirm', () => {
    const confirmUrl = `${environment.apiBaseUrl}/v1/pacientes/5/internacoes/9/movimentacao-leito/confirmar`;

    it('200: posts the trimmed bed to the stay route', async () => {
      const result = service.confirm(5, 9, ' 412 ');
      const req = http.expectOne(confirmUrl);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ newBedNumber: '412' });
      req.flush({ id: 9, pacienteId: 5, bedNumber: '412', createdAt: 'x' });

      await expectAsync(result).toBeResolved();
    });

    it('US-002-2-05: o histórico é efeito do servidor; o cliente envia só o novo leito', async () => {
      const result = service.confirm(5, 9, '412');
      const req = http.expectOne(confirmUrl);

      expect(Object.keys(req.request.body as object)).toEqual(['newBedNumber']);
      req.flush({ id: 9, pacienteId: 5, bedNumber: '412', createdAt: 'x' });
      await result;

      http.verify();
    });

    it('US-002-2-05: o serviço não expõe operação de editar ou remover histórico', () => {
      const names = Object.getOwnPropertyNames(Object.getPrototypeOf(service));

      expect(names.filter(n => /histor|update|edit|delete|remove/i.test(n))).toEqual([]);
    });

    it('422 MSG-12 becomes BedNotIdentifiedError', async () => {
      const result = service.confirm(5, 9, '412');

      http.expectOne(confirmUrl).flush({ code: 'MSG-12', message: 'x' }, { status: 422, statusText: 'U' });

      await expectAsync(result).toBeRejectedWith(new BedNotIdentifiedError('newBedNumber', 'x'));
    });

    it('422 MSG-12 without field or message falls back to defaults', async () => {
      const result = service.confirm(5, 9, '412');

      http.expectOne(confirmUrl).flush({ code: 'MSG-12' }, { status: 422, statusText: 'U' });

      await expectAsync(result).toBeRejectedWith(new BedNotIdentifiedError('newBedNumber', ''));
    });

    it('422 with an unknown code or empty body stays the HTTP error', async () => {
      const result = service.confirm(5, 9, '412');

      http.expectOne(confirmUrl).flush(null, { status: 422, statusText: 'U' });

      await expectAsync(result).toBeRejectedWith(jasmine.any(HttpErrorResponse));
    });

    for (const status of [403, 404, 500]) {
      it(`${status} reaches the caller as the original HTTP error`, async () => {
        const result = service.confirm(5, 9, '412');

        http.expectOne(confirmUrl).flush({}, { status, statusText: 'E' });

        await expectAsync(result).toBeRejectedWith(jasmine.any(HttpErrorResponse));
      });
    }
  });

  describe('resolveByName (US-002-2-02)', () => {
    const byName = `${environment.apiBaseUrl}/v1/pacientes/movimentacao-leito/resolver-por-nome`;

    it('ENCONTRADO: sends hospital, name and bed and returns the single resolved movement', async () => {
      const result = service.resolveByName(3, 'Beatriz Ramos Costa', ' 210 ');
      const req = http.expectOne(byName);

      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ fullName: 'Beatriz Ramos Costa', hospitalId: 3, newBedNumber: '210' });
      req.flush({ resolvida: resolved, status: 'ENCONTRADO' });

      await expectAsync(result).toBeResolvedTo({ kind: 'single', resolved });
    });

    it('omits the bed when it was not extracted', async () => {
      const result = service.resolveByName(3, 'Beatriz');
      const req = http.expectOne(byName);

      expect(req.request.body).toEqual({ fullName: 'Beatriz', hospitalId: 3 });
      req.flush({ resolvida: resolved, status: 'ENCONTRADO' });
      await result;
    });

    it('MULTIPLOS: returns the candidates', async () => {
      const candidatos = [
        { birthDate: '1990-01-02', fullName: 'Beatriz Ramos Costa', id: 1, medicalRecordNumber: 'S1' },
        { birthDate: '1985-05-06', fullName: 'Beatriz Ramos Costa', id: 2, medicalRecordNumber: null },
      ];
      const result = service.resolveByName(3, 'Beatriz Ramos Costa', '210');

      http.expectOne(byName).flush({ candidatos, status: 'MULTIPLOS' });

      await expectAsync(result).toBeResolvedTo({ candidates: candidatos, kind: 'multiple' });
    });

    it('MULTIPLOS without a list returns no candidates', async () => {
      const result = service.resolveByName(3, 'Beatriz', '1');

      http.expectOne(byName).flush({ status: 'MULTIPLOS' });

      await expectAsync(result).toBeResolvedTo({ candidates: [], kind: 'multiple' });
    });

    it('404 MSG-13 becomes PatientNotFoundError with the server message', async () => {
      const result = service.resolveByName(3, 'Otávio', '210');

      http.expectOne(byName).flush({ code: 'MSG-13', message: 'nada' }, { status: 404, statusText: 'N' });

      await expectAsync(result).toBeRejectedWith(new PatientNotFoundError('nada'));
    });

    it('404 MSG-13 without message uses an empty message', async () => {
      const result = service.resolveByName(3, 'Otávio', '210');

      http.expectOne(byName).flush({ code: 'MSG-13' }, { status: 404, statusText: 'N' });

      await expectAsync(result).toBeRejectedWithError(PatientNotFoundError, '');
    });

    it('422 MSG-11 and MSG-12 become the existing domain errors', async () => {
      const first = service.resolveByName(3, 'Beatriz', '210');

      http.expectOne(byName).flush({ code: 'MSG-11', message: 'a' }, { status: 422, statusText: 'U' });
      await expectAsync(first).toBeRejectedWith(new PatientWithoutInternacaoError('a'));

      const second = service.resolveByName(3, 'Beatriz');

      http
        .expectOne(byName)
        .flush({ code: 'MSG-12', field: 'newBedNumber', message: 'b' }, { status: 422, statusText: 'U' });
      await expectAsync(second).toBeRejectedWith(new BedNotIdentifiedError('newBedNumber', 'b'));
    });

    it('other errors, including 404 without MSG-13, stay generic', async () => {
      const statuses = [400, 401, 403, 404, 500];
      const results = statuses.map(status => {
        const result = service.resolveByName(3, 'Beatriz', '1');

        http.expectOne(byName).flush(null, { status, statusText: 'E' });

        return result.catch((e: unknown) => (e as HttpErrorResponse).status);
      });

      expect(await Promise.all(results)).toEqual(statuses);
    });
  });
});
