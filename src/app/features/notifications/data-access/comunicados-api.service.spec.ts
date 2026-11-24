import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ComunicadosApiService } from './comunicados-api.service';

describe('ComunicadosApiService', () => {
  let api: ComunicadosApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ComunicadosApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('create: POST /v1/comunicados com hospital, conteúdo e destinatários confirmados', () => {
    const recipients = [{ professionalId: 3, type: 'PESSOA' as const }, { type: 'TODOS' as const }];

    api.create(1, 'Aviso', recipients).subscribe();
    const req = http.expectOne(r => r.url.endsWith('/v1/comunicados'));

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ content: 'Aviso', hospitalId: 1, recipients });
    req.flush({});
  });

  it('create: propaga o 422 (sem destinatário válido)', () => {
    let status = 0;

    api.create(1, 'Aviso', []).subscribe({ error: (e: unknown) => (status = (e as { status: number }).status) });
    http
      .expectOne(r => r.url.endsWith('/v1/comunicados'))
      .flush({ message: 'x' }, { status: 422, statusText: 'Unprocessable' });

    expect(status).toBe(422);
  });

  it('resolveRecipients: POST /v1/comunicados/destinatarios/resolver', () => {
    let count = 0;

    api.resolveRecipients(1, [{ perfil: 'medicos', type: 'GRUPO' }]).subscribe(r => (count = r.professionals.length));
    const req = http.expectOne(r => r.url.endsWith('/v1/comunicados/destinatarios/resolver'));

    expect(req.request.body).toEqual({ hospitalId: 1, recipients: [{ perfil: 'medicos', type: 'GRUPO' }] });
    req.flush({ professionals: [{ id: 1, name: 'A', specialty: 'B' }] });

    expect(count).toBe(1);
  });
});
