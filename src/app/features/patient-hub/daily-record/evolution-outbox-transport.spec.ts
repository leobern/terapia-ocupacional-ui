import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OutboxOperation } from '../../../shared/offline/offline-store';
import { EvolutionOutboxTransport } from './evolution-outbox-transport';

const operation = (extra: Partial<OutboxOperation>): OutboxOperation => ({
  attempted: true,
  attempts: 0,
  day: '2026-11-26',
  nextAttemptAt: 'x',
  occurredAt: '2026-11-26T10:00:00.000Z',
  opId: '11111111-1111-4111-8111-111111111111',
  patientId: '42',
  payload: {},
  seq: 1,
  status: 'sending',
  type: 'evolution-text',
  userId: 'ana@x.com',
  ...extra,
});

describe('EvolutionOutboxTransport', () => {
  let transport: EvolutionOutboxTransport;
  let ctrl: HttpTestingController;
  const base = '/api/v1/pacientes/42/evolucoes/2026-11-26';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    transport = TestBed.inject(EvolutionOutboxTransport);
    ctrl = TestBed.inject(HttpTestingController);
  });

  it('texto: POST /texto com baseVersion, occurredAt e a opId como Idempotency-Key', async () => {
    const promise = transport.send(operation({ baseVersion: 4, payload: { author: 'Ana', origin: 'AI', text: 'oi' } }));
    const request = ctrl.expectOne(`${base}/texto`);

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('11111111-1111-4111-8111-111111111111');
    expect(request.request.body).toEqual({
      baseVersion: 4,
      occurredAt: '2026-11-26T10:00:00.000Z',
      origin: 'AI',
      text: 'oi',
    });
    request.flush({ conflict: false, version: 5 });

    expect(await promise).toEqual({ version: 5 });
  });

  it('texto sem base conhecida não manda baseVersion; resposta sem version vira 0', async () => {
    const promise = transport.send(operation({ payload: { origin: 'MANUAL', text: 'oi' } }));
    const request = ctrl.expectOne(`${base}/texto`);

    expect('baseVersion' in request.request.body).toBeFalse();
    request.flush({});

    expect(await promise).toEqual({ version: 0 });
  });

  it('texto gravado sobre base defasada volta como conflito com as versões que não tinha visto', async () => {
    const promise = transport.send(operation({ baseVersion: 1, payload: { origin: 'MANUAL', text: 'meu' } }));

    ctrl.expectOne(`${base}/texto`).flush({
      conflict: true,
      conflictingVersions: [{ at: '2026-11-26T09:00:00Z', author: 'Bia', text: 'dela', version: 3 }],
      version: 4,
    });

    expect(await promise).toEqual({
      conflict: { currentVersion: 4, others: [{ at: '2026-11-26T09:00:00Z', author: 'Bia', text: 'dela' }] },
      version: 4,
    });
  });

  it('conflito sem lista de versões também é tratado', async () => {
    const promise = transport.send(operation({ payload: { origin: 'MANUAL', text: 'meu' } }));

    ctrl.expectOne(`${base}/texto`).flush({ conflict: true, version: 2 });

    expect((await promise).conflict).toEqual({ currentVersion: 2, others: [] });
  });

  it('parâmetros: POST /parametros', async () => {
    const parameters = [{ parameterId: 'glycemia', value: 132 }];
    const promise = transport.send(operation({ payload: { author: 'Ana', parameters }, type: 'parameters' }));
    const request = ctrl.expectOne(`${base}/parametros`);

    expect(request.request.headers.get('Idempotency-Key')).toBe('11111111-1111-4111-8111-111111111111');
    expect(request.request.body).toEqual({ occurredAt: '2026-11-26T10:00:00.000Z', parameters });
    request.flush({ id: 1 });

    expect(await promise).toEqual({});
  });

  it('reavaliações: POST /reavaliacoes', async () => {
    const reevaluations = [{ dueAt: '2026-11-28T10:00:00.000Z', id: 'r1', name: 'Diarreia' }];
    const promise = transport.send(operation({ payload: { reevaluations }, type: 'reevaluations' }));
    const request = ctrl.expectOne(`${base}/reavaliacoes`);

    expect(request.request.body).toEqual({ occurredAt: '2026-11-26T10:00:00.000Z', reevaluations });
    request.flush({ id: 2 });

    expect(await promise).toEqual({});
  });

  it('erros do servidor sobem para o sincronizador classificar', async () => {
    const promise = transport.send(operation({ payload: { origin: 'MANUAL', text: 'x' } }));

    ctrl.expectOne(`${base}/texto`).flush({ message: 'x' }, { status: 400, statusText: 'Bad Request' });

    await expectAsync(promise).toBeRejected();
  });
});
