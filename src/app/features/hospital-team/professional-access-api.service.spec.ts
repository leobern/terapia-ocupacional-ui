import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';

import { ProfessionalAccessApiService } from './professional-access-api.service';

describe('ProfessionalAccessApiService', () => {
  let service: ProfessionalAccessApiService;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/v1/hospitais/1/profissionais/7/revogacao`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProfessionalAccessApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfessionalAccessApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('200: faz POST na revogação e resolve', async () => {
    const result = service.revoke(1, 7);
    const req = http.expectOne(url);

    expect(req.request.method).toBe('POST');
    req.flush({ hospitalId: 1, status: 'REVOGADO', updatedAt: '2026-11-24T12:00:00Z', usuarioId: 7, vinculoId: 3 });

    await expectAsync(result).toBeResolved();
  });

  for (const status of [401, 403, 404, 409]) {
    it(`${status}: rejeita com o erro HTTP`, async () => {
      const result = service.revoke(1, 7);

      http.expectOne(url).flush({ message: 'x', timestamp: '2026-11-24T12:00:00Z' }, { status, statusText: 'err' });

      await expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ status }));
    });
  }

  it('rejeita identificador inválido sem chamar a API', async () => {
    await expectAsync(service.revoke(1, Number.NaN)).toBeRejected();
    http.expectNone(url);
  });
});
