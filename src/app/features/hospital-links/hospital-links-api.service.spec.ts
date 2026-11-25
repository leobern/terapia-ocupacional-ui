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

  it('busca hospitais por nome, sem cursor no primeiro lote', async () => {
    const promise = service.search('san', null);
    const req = http.expectOne(r => r.url === '/api/v1/vinculos/hospitais');

    expect(req.request.params.get('nome')).toBe('san');
    expect(req.request.params.has('cursor')).toBeFalse();
    req.flush({ items: [{ id: 1, name: 'Santa Casa' }], nextCursor: 'c1' });

    expect(await promise).toEqual({ items: [{ id: 1, name: 'Santa Casa' }], nextCursor: 'c1' });
  });

  it('envia o cursor no lote seguinte', async () => {
    const promise = service.search('san', 'c1');
    const req = http.expectOne(r => r.url === '/api/v1/vinculos/hospitais');

    expect(req.request.params.get('cursor')).toBe('c1');
    req.flush({ items: [], nextCursor: null });
    await promise;
  });

  it('solicita acesso e mapeia a resposta 201 para o modelo da tela', async () => {
    const promise = service.request(3);
    const req = http.expectOne('/api/v1/vinculos/solicitacoes');

    expect(req.request.body).toEqual({ hospitalId: 3 });
    req.flush(
      { createdAt: '2026-11-21T09:00:00Z', hospital: { id: 3, name: 'Beta' }, id: 5, status: 'AGUARDANDO_APROVACAO' },
      { status: 201, statusText: 'Created' },
    );

    expect(await promise).toEqual({
      hospitalId: 3,
      hospitalName: 'Beta',
      id: 5,
      status: 'pending',
      updatedAt: '2026-11-21T09:00:00Z',
    });
  });

  it('rejeita com o erro HTTP no 409 da solicitação', async () => {
    const promise = service.request(3);

    http.expectOne('/api/v1/vinculos/solicitacoes').flush({ message: 'x' }, { status: 409, statusText: 'Conflict' });

    await expectAsync(promise).toBeRejectedWith(jasmine.objectContaining({ status: 409 }));
  });
});
