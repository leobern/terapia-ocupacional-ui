import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ObservationFollowUpApiService } from './observation-follow-up-api.service';

describe('ObservationFollowUpApiService', () => {
  let http: HttpTestingController;
  let service: ObservationFollowUpApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ObservationFollowUpApiService],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ObservationFollowUpApiService);
  });

  it('lê as sugestões (GET .../sugestoes)', async () => {
    const done = service.suggestions('7', '90');
    const req = http.expectOne(r => r.url.endsWith('/v1/pacientes/7/mensagens/90/sugestoes'));

    expect(req.request.method).toBe('GET');
    req.flush({ comunicacao: null, pendencia: null });

    expect(await done).toEqual({ comunicacao: null, pendencia: null });
  });

  it('cria a pendência sem destinatários quando vale o padrão e com eles quando substituídos', async () => {
    const standard = service.createPending('7', '90', '2026-11-27T12:00:00.000Z', null);
    const first = http.expectOne(r => r.url.endsWith('/mensagens/90/pendencia'));

    expect(first.request.body).toEqual({ dueAt: '2026-11-27T12:00:00.000Z' });
    first.flush({});
    await standard;

    const custom = service.createPending('7', '90', 'x', [{ professionalId: 5, type: 'PESSOA' }]);
    const second = http.expectOne(r => r.url.endsWith('/mensagens/90/pendencia'));

    expect(second.request.body).toEqual({ destinatarios: [{ professionalId: 5, type: 'PESSOA' }], dueAt: 'x' });
    second.flush({});
    await custom;
  });

  it('envia a comunicação e altera destinatários da pendência', async () => {
    const send = service.sendCommunication('7', '90', 'texto', [{ type: 'TODOS' }]);
    const req = http.expectOne(r => r.url.endsWith('/mensagens/90/comunicacao'));

    expect(req.request.body).toEqual({ content: 'texto', destinatarios: [{ type: 'TODOS' }] });
    req.flush({});
    await send;

    const change = service.changePendingRecipients('7', '31', [{ professionalId: 5, type: 'PESSOA' }]);
    const put = http.expectOne(r => r.url.endsWith('/mensagens/31/destinatarios'));

    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ destinatarios: [{ professionalId: 5, type: 'PESSOA' }] });
    put.flush({});
    await change;
  });
});
