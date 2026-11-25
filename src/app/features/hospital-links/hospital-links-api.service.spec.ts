import { provideHttpClient } from '@angular/common/http';
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

  it('searches by name without cursor on the first page', async () => {
    const promise = service.search('san', null);
    const req = http.expectOne(r => r.url === '/api/v1/vinculos/hospitais');

    expect(req.request.params.get('nome')).toBe('san');
    expect(req.request.params.has('cursor')).toBeFalse();
    req.flush({ items: [{ id: 1, name: 'Santa Casa' }], nextCursor: 'c1' });

    expect(await promise).toEqual({ items: [{ id: 1, name: 'Santa Casa' }], nextCursor: 'c1' });
  });

  it('sends the cursor on the next page', async () => {
    const promise = service.search('san', 'c1');
    const req = http.expectOne(r => r.url === '/api/v1/vinculos/hospitais');

    expect(req.request.params.get('cursor')).toBe('c1');
    req.flush({ items: [], nextCursor: null });
    await promise;
  });

  it('lists links mapped to the screen model', async () => {
    const promise = service.list();

    http.expectOne('/api/v1/vinculos').flush({
      hasApprovedLink: false,
      items: [{ hospitalId: 2, hospitalName: 'HC', id: 9, status: 'APROVADO', updatedAt: '2026-01-01T00:00:00Z' }],
    });

    expect(await promise).toEqual([{ hospitalId: 2, hospitalName: 'HC', id: 9, status: 'APROVADO' }]);
  });

  it('requests access and maps the 201 response', async () => {
    const promise = service.request(3);
    const req = http.expectOne('/api/v1/vinculos/solicitacoes');

    expect(req.request.body).toEqual({ hospitalId: 3 });
    req.flush(
      { createdAt: 'x', hospital: { id: 3, name: 'Beta' }, id: 5, status: 'AGUARDANDO_APROVACAO' },
      { status: 201, statusText: 'Created' },
    );

    expect(await promise).toEqual({ hospitalId: 3, hospitalName: 'Beta', id: 5, status: 'AGUARDANDO_APROVACAO' });
  });

  it('rejects with the HTTP error on 409', async () => {
    const promise = service.request(3);

    http.expectOne('/api/v1/vinculos/solicitacoes').flush({ message: 'x' }, { status: 409, statusText: 'Conflict' });

    await expectAsync(promise).toBeRejectedWith(jasmine.objectContaining({ status: 409 }));
  });
});
