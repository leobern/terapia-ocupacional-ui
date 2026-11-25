import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MensagemThreadDto, PatientThreadsApiService, toMessageThread } from './patient-threads-api.service';

const ANA = { id: 1, name: 'Ana', specialty: 'Médica' };
const BRUNO = { id: 2, name: 'Bruno', specialty: 'Enfermeiro' };

const thread = (id: number, extra: Partial<MensagemThreadDto> = {}): MensagemThreadDto => ({
  author: ANA,
  createdAt: `2026-11-2${id}T10:00:00Z`,
  description: `texto ${id}`,
  id,
  overdue: false,
  replies: [],
  replyCount: 0,
  status: 'pending',
  type: 'patient_message',
  ...extra,
});

describe('PatientThreadsApiService', () => {
  let http: HttpTestingController;
  let service: PatientThreadsApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PatientThreadsApiService],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PatientThreadsApiService);
  });

  it('lista em lotes de 10 seguindo o cursor, da mais antiga à mais nova (uma chamada por lote)', async () => {
    const done = service.list('7');
    const first = http.expectOne(r => r.url.endsWith('/v1/pacientes/7/mensagens'));

    expect(first.request.params.get('limit')).toBe('10');
    expect(first.request.params.has('cursor')).toBeFalse();
    first.flush({ items: [thread(3), thread(2)], nextCursor: 'abc' });
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve));
    const second = http.expectOne(r => r.params.get('cursor') === 'abc');

    second.flush({ items: [thread(1)], nextCursor: null });

    expect((await done).map(t => t.id)).toEqual(['1', '2', '3']);
    http.verify();
  });

  it('mapeia prazo, destinatários, respostas e resolução', () => {
    const mapped = toMessageThread(
      thread(5, {
        dueAt: '2026-11-30T10:00:00Z',
        recipients: [
          { type: 'GRUPO', perfil: 'Enfermeiro' },
          { type: 'PESSOA', professionalId: 2 },
          { type: 'PESSOA', professionalId: 99 },
          { type: 'TODOS' },
        ],
        replies: [{ author: BRUNO, createdAt: '2026-11-25T11:00:00Z', id: 8, text: 'ok' }],
        resolvedAt: '2026-11-26T09:00:00Z',
        status: 'resolved',
        type: 'reevaluation_pending',
      }),
      '7',
    );

    expect(mapped.deadline).toBe('2026-11-30T10:00:00Z');
    expect(mapped.recipients).toEqual(['@Enfermeiro', '@Bruno', '@todos']);
    expect(mapped.replies).toEqual([
      { at: '2026-11-25T11:00:00Z', author: 'Bruno', id: '8', origin: 'text', text: 'ok' },
    ]);

    expect(mapped.resolved).toBeTrue();
    expect(mapped.statusChanges).toEqual([{ at: '2026-11-26T09:00:00Z', author: '', kind: 'resolved' }]);
    expect(toMessageThread({ ...thread(1), author: undefined }, '7').author).toBe('');
    expect(toMessageThread(thread(1), '7')).toEqual(
      jasmine.objectContaining({ deadline: null, recipients: [], resolved: false, statusChanges: [] }),
    );
  });

  it('responde pela API e devolve a thread atualizada', async () => {
    const done = service.reply({
      at: 'x',
      author: 'Ana',
      origin: 'text',
      patientId: '7',
      text: 'oi',
      threadId: '3',
    });
    const req = http.expectOne(r => r.url.endsWith('/v1/pacientes/7/mensagens/3/respostas'));

    expect(req.request.body).toEqual({ text: 'oi' });
    req.flush(thread(3, { replies: [{ author: ANA, createdAt: '2026-11-25T12:00:00Z', id: 1, text: 'oi' }] }));

    expect((await done).replies.length).toBe(1);
  });

  it('resolve pelo registro único das notificações e marca a thread carregada', async () => {
    const list = service.list('7');

    http.expectOne(r => r.url.endsWith('/mensagens')).flush({ items: [thread(3)], nextCursor: null });
    await list;

    const done = service.resolve({ at: '2026-11-26T09:00:00.000Z', author: 'Ana', patientId: '7', threadId: '3' });
    const req = http.expectOne(r => r.url.endsWith('/v1/notifications/3/resolve'));

    expect(req.request.method).toBe('POST');
    req.flush({});
    const updated = await done;

    expect(updated.resolved).toBeTrue();
    expect(updated.statusChanges).toEqual([{ at: '2026-11-26T09:00:00.000Z', author: 'Ana', kind: 'resolved' }]);

    const again = service.resolve({ at: 'y', author: 'Ana', patientId: '7', threadId: '3' });

    http.expectOne(r => r.url.endsWith('/v1/notifications/3/resolve')).flush({});

    expect((await again).statusChanges.length).toBe(1);
  });

  it('resolve de thread nunca carregada rejeita; erro HTTP (403) é propagado', async () => {
    const unknown = service.resolve({ at: 'y', author: 'Ana', patientId: '7', threadId: '77' });

    http.expectOne(r => r.url.endsWith('/v1/notifications/77/resolve')).flush({});
    await expectAsync(unknown).toBeRejected();

    const forbidden = service.resolve({ at: 'y', author: 'Ana', patientId: '7', threadId: '78' });

    http
      .expectOne(r => r.url.endsWith('/v1/notifications/78/resolve'))
      .flush({}, { status: 403, statusText: 'Forbidden' });
    await expectAsync(forbidden).toBeRejected();
  });
});
