import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Role, SessionRoleReader } from '../../../shared/auth/session-role';
import { HomeHospitalsApiService } from './home-hospitals-api.service';

describe('HomeHospitalsApiService', () => {
  let service: HomeHospitalsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HomeHospitalsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HomeHospitalsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lê os hospitais vinculados do backend com id numérico', async () => {
    const result = service.read();

    http.expectOne(r => r.url.endsWith('/v1/home/hospitals')).flush([{ id: 3, name: 'Hospital A' }]);

    expect(await result).toEqual([{ id: 3, name: 'Hospital A' }]);
  });

  it('gestor lê todos os hospitais em /v1/hospitais, sem chamar a rota da Home', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        HomeHospitalsApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionRoleReader, useValue: { read: (): Role => Role.GESTOR } },
      ],
    });
    service = TestBed.inject(HomeHospitalsApiService);
    http = TestBed.inject(HttpTestingController);

    const result = service.read();

    http.expectOne(r => r.url.endsWith('/v1/hospitais')).flush([{ id: 1, nome: 'Hospital A' }]);

    expect(await result).toEqual([{ id: 1, name: 'Hospital A' }]);
  });

  it('rejeita quando o backend responde erro', async () => {
    const result = service.read();

    http
      .expectOne(r => r.url.endsWith('/v1/home/hospitals'))
      .flush({ message: 'x' }, { status: 401, statusText: 'Unauthorized' });

    await expectAsync(result).toBeRejected();
  });
});
