import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';

import { BedNotIdentifiedError, PatientWithoutInternacaoError } from './bed-movement.port';
import { BedOccupancyApiService } from './bed-occupancy-api.service';

describe('BedOccupancyApiService', () => {
  let service: BedOccupancyApiService;
  let http: HttpTestingController;
  const path = `${environment.apiBaseUrl}/v1/pacientes/5/internacoes/movimentacao-leito/ocupacao`;
  const expectGet = (): ReturnType<HttpTestingController['expectOne']> => {
    const req = http.expectOne(r => r.url === path);

    expect(req.request.method).toBe('GET');

    return req;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BedOccupancyApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BedOccupancyApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('free bed: not occupied with no occupants (RN-03)', async () => {
    const result = service.check(5, ' 415 ');
    const req = expectGet();

    expect(req.request.params.get('newBedNumber')).toBe('415');
    const body = { newBedNumber: '415', occupants: [], occupied: false };

    req.flush(body);

    await expectAsync(result).toBeResolvedTo(body);
  });

  it('occupied bed: returns the occupant names (RN-02)', async () => {
    const result = service.check(5, '412');
    const body = { newBedNumber: '412', occupants: [{ name: 'Helena Duarte Ramos', pacienteId: 7 }], occupied: true };

    expectGet().flush(body);

    await expectAsync(result).toBeResolvedTo(body);
  });

  it('422 MSG-11 becomes PatientWithoutInternacaoError', async () => {
    const result = service.check(5, '412');

    expectGet().flush({ code: 'MSG-11', message: 'sem internação' }, { status: 422, statusText: 'U' });

    await expectAsync(result).toBeRejectedWithError(PatientWithoutInternacaoError, 'sem internação');
  });

  it('422 MSG-12 becomes BedNotIdentifiedError', async () => {
    const result = service.check(5, '');

    expectGet().flush(
      { code: 'MSG-12', field: 'newBedNumber', message: 'sem leito' },
      { status: 422, statusText: 'U' },
    );

    await expectAsync(result).toBeRejectedWithError(BedNotIdentifiedError, 'sem leito');
  });

  it('other errors propagate unchanged', async () => {
    const result = service.check(5, '412');

    expectGet().flush(null, { status: 403, statusText: 'F' });

    await expectAsync(result).toBeRejectedWith(jasmine.any(HttpErrorResponse));
  });
});
