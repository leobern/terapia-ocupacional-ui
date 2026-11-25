import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiHypothesisWriter } from './api-hypothesis-writer';
import { HypothesisSaveRequest } from './patient-hub.models';
import { ProvisionalHypothesisWriter } from './provisional-patient-hub';

describe('ApiHypothesisWriter', () => {
  let writer: ApiHypothesisWriter;
  let http: HttpTestingController;
  const request = (patientId: string, origin: HypothesisSaveRequest['origin']): HypothesisSaveRequest => ({
    at: '2026-11-25T10:00:00Z',
    author: 'Dra. X',
    origin,
    patientId,
    text: 'Pós-operatório',
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [ApiHypothesisWriter, ProvisionalHypothesisWriter, provideHttpClient(), provideHttpClientTesting()],
    });
    writer = TestBed.inject(ApiHypothesisWriter);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('id numérico grava com PUT só com texto e origem (autor e hora são do servidor)', async () => {
    const done = writer.save(request('42', 'ai-edited'));
    const req = http.expectOne('/api/v1/pacientes/42/diagnostico');

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ origin: 'AI_EDITED', text: 'Pós-operatório' });
    req.flush({});
    await done;
  });

  it('mapeia as origens ai e manual', async () => {
    const ai = writer.save(request('7', 'ai'));
    const aiReq = http.expectOne('/api/v1/pacientes/7/diagnostico');

    expect((aiReq.request.body as { origin: string }).origin).toBe('AI');
    aiReq.flush({});
    await ai;

    const manual = writer.save(request('8', 'manual'));
    const manualReq = http.expectOne('/api/v1/pacientes/8/diagnostico');

    expect((manualReq.request.body as { origin: string }).origin).toBe('MANUAL');
    manualReq.flush({});
    await manual;
  });

  it('erro do servidor sobe para a tela mostrar a falha', async () => {
    const done = writer.save(request('9', 'manual'));

    http.expectOne('/api/v1/pacientes/9/diagnostico').flush({}, { status: 400, statusText: 'Bad Request' });
    await expectAsync(done).toBeRejected();
  });

  it('id de exemplo grava no provisório e não chama a API', async () => {
    await writer.save(request('p1', 'manual'));

    http.expectNone('/api/v1/pacientes/p1/diagnostico');

    expect(localStorage.length).toBeGreaterThan(0);
  });
});
