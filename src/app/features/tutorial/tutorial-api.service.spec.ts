import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TutorialApiService } from './tutorial-api.service';

describe('TutorialApiService', () => {
  let service: TutorialApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TutorialApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TutorialApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  for (const status of ['PENDENTE', 'CONCLUIDO', 'PULADO'] as const) {
    it(`reads ${status} from GET /api/v1/tutorial`, async () => {
      const result = service.read();

      http.expectOne({ method: 'GET', url: '/api/v1/tutorial' }).flush({ registradoEm: null, status });

      expect(await result).toBe(status);
    });
  }

  it('rejects the read on 401', async () => {
    const result = service.read();

    http
      .expectOne('/api/v1/tutorial')
      .flush(
        { message: 'Não autenticado', timestamp: '2026-11-24T10:00:00Z' },
        { status: 401, statusText: 'Unauthorized' },
      );

    await expectAsync(result).toBeRejected();
  });

  for (const resultado of ['CONCLUIDO', 'PULADO'] as const) {
    it(`registers ${resultado} with PUT /api/v1/tutorial`, async () => {
      const result = service.register(resultado);
      const req = http.expectOne({ method: 'PUT', url: '/api/v1/tutorial' });

      expect(req.request.body).toEqual({ resultado });

      req.flush({ registradoEm: '2026-11-24T10:00:00Z', status: resultado });

      await expectAsync(result).toBeResolved();
    });
  }

  it('rejects the registration on network error', async () => {
    const result = service.register('PULADO');

    http.expectOne('/api/v1/tutorial').error(new ProgressEvent('error'));

    await expectAsync(result).toBeRejected();
  });
});
