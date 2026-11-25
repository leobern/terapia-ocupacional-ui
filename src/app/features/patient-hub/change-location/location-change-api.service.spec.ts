import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';

import { PatientWithoutInternacaoError } from '../move-bed/bed-movement.port';
import { LocationNotIdentifiedError } from './location-change.port';
import { LocationChangeApiService } from './location-change-api.service';

describe('LocationChangeApiService', () => {
  let service: LocationChangeApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/v1/pacientes/5/internacoes`;
  const resolved = {
    action: 'CREATE',
    currentValue: null,
    internacaoId: 9,
    locationType: 'UNIDADE',
    newValue: 'UTI',
    pacienteId: 5,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LocationChangeApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LocationChangeApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('resolve posts type and trimmed value', async () => {
    const result = service.resolve(5, 'UNIDADE', ' UTI ');
    const req = http.expectOne(`${base}/localizacao/resolver`);

    expect(req.request.body).toEqual({ locationType: 'UNIDADE', locationValue: 'UTI' });
    req.flush(resolved);

    await expectAsync(result).toBeResolvedTo(resolved as never);
  });

  it('confirm posts to the internacao', async () => {
    const result = service.confirm(5, 9, 'ALA', 'Ala Norte');
    const req = http.expectOne(`${base}/9/localizacao/confirmar`);

    expect(req.request.body).toEqual({ locationType: 'ALA', locationValue: 'Ala Norte' });
    req.flush({});

    await expectAsync(result).toBeResolved();
  });

  it('422 MSG-11 becomes PatientWithoutInternacaoError', async () => {
    const result = service.resolve(5, 'ALA', 'x');

    http
      .expectOne(`${base}/localizacao/resolver`)
      .flush({ code: 'MSG-11', message: 'sem' }, { status: 422, statusText: 'U' });

    await expectAsync(result).toBeRejectedWith(new PatientWithoutInternacaoError('sem'));
  });

  it('422 MSG-11 without message uses empty text', async () => {
    const result = service.resolve(5, 'ALA', 'x');

    http.expectOne(`${base}/localizacao/resolver`).flush({ code: 'MSG-11' }, { status: 422, statusText: 'U' });

    await expectAsync(result).toBeRejectedWithError(PatientWithoutInternacaoError);
  });

  it('422 MSG-10 and MSG-09 become LocationNotIdentifiedError', async () => {
    const first = service.confirm(5, 9, 'ALA', ' ');

    http
      .expectOne(`${base}/9/localizacao/confirmar`)
      .flush({ code: 'MSG-10', field: 'locationValue', message: 'm' }, { status: 422, statusText: 'U' });
    await expectAsync(first).toBeRejectedWith(new LocationNotIdentifiedError('locationValue', 'MSG-10', 'm'));

    const second = service.resolve(5, 'ALA', 'x');

    http.expectOne(`${base}/localizacao/resolver`).flush({ code: 'MSG-09' }, { status: 422, statusText: 'U' });
    await expectAsync(second).toBeRejectedWithError(LocationNotIdentifiedError);
  });

  it('other errors pass through', async () => {
    const result = service.resolve(5, 'ALA', 'x');

    http.expectOne(`${base}/localizacao/resolver`).flush({}, { status: 500, statusText: 'E' });
    await expectAsync(result).toBeRejected();

    const unknown = service.resolve(5, 'ALA', 'x');

    http.expectOne(`${base}/localizacao/resolver`).flush({ code: 'X' }, { status: 422, statusText: 'U' });
    await expectAsync(unknown).toBeRejected();

    const empty = service.resolve(5, 'ALA', 'x');

    http.expectOne(`${base}/localizacao/resolver`).flush(null, { status: 422, statusText: 'U' });
    await expectAsync(empty).toBeRejected();
  });
});
