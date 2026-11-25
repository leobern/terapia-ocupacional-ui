import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HospitalLinksApiService } from './hospital-links-api.service';

describe('HospitalLinksApiService', () => {
  let service: HospitalLinksApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HospitalLinksApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HospitalLinksApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const item = (id: number, status: string): Record<string, unknown> => ({
    hospitalId: id,
    hospitalName: `Hospital ${id}`,
    id,
    status,
    updatedAt: '2026-11-20T10:00:00Z',
  });

  it('lê GET /api/v1/vinculos e mapeia os 4 status do contrato', async () => {
    const result = service.list();
    const req = http.expectOne('/api/v1/vinculos');

    expect(req.request.method).toBe('GET');
    req.flush({
      hasApprovedLink: true,
      items: [item(1, 'APROVADO'), item(2, 'AGUARDANDO_APROVACAO'), item(3, 'RECUSADO'), item(4, 'REVOGADO')],
    });
    const { items, hasApprovedLink } = await result;

    expect(hasApprovedLink).toBeTrue();
    expect(items.map(i => i.status)).toEqual(['approved', 'pending', 'refused', 'revoked']);
    expect(items[0]).toEqual({
      hospitalId: 1,
      hospitalName: 'Hospital 1',
      id: 1,
      status: 'approved',
      updatedAt: '2026-11-20T10:00:00Z',
    });
  });

  it('trata status desconhecido como aguardando aprovação', async () => {
    const result = service.list();

    http.expectOne('/api/v1/vinculos').flush({ hasApprovedLink: false, items: [item(1, 'OUTRO')] });

    expect((await result).items[0].status).toBe('pending');
  });

  it('lista vazia (primeiro acesso) devolve zero itens', async () => {
    const result = service.list();

    http.expectOne('/api/v1/vinculos').flush({ hasApprovedLink: false, items: [] });

    expect(await result).toEqual({ hasApprovedLink: false, items: [] });
  });

  for (const status of [401, 403, 500]) {
    it(`rejeita com HttpErrorResponse no erro ${status}`, async () => {
      const result = service.list();

      http.expectOne('/api/v1/vinculos').flush(null, { status, statusText: 'erro' });

      await expectAsync(result).toBeRejectedWith(jasmine.any(HttpErrorResponse));
    });
  }
});
