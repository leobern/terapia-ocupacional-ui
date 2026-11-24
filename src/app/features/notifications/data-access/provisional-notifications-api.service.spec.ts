import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { ProfessionalProfileReader } from '../../home/professional-profile';
import { PatientMessagesSource, PatientMessagesWriter } from '../../patient-messages/patient-messages-source';
import { ProvisionalPatientMessages } from '../../patient-messages/provisional-patient-messages';
import { type NotificationPage } from '../notifications.models';
import { ProvisionalNotificationsApiService } from './provisional-notifications-api.service';

const PROVIDERS = [
  provideHttpClient(),
  provideHttpClientTesting(),
  ProvisionalNotificationsApiService,
  ProvisionalPatientMessages,
  { provide: PatientMessagesSource, useExisting: ProvisionalPatientMessages },
  { provide: PatientMessagesWriter, useExisting: ProvisionalPatientMessages },
  {
    provide: ProfessionalProfileReader,
    useValue: { read: (): object => ({ name: 'Michelle Franklin', role: 'doctor' }) },
  },
];

const REAL = {
  author: { id: 1, name: 'Gestor', photoUrl: null, specialty: 'Médico' },
  createdAt: '2026-11-24T13:15:01.000Z',
  description: 'Reunião amanhã',
  id: 3,
  read: true,
  replyCount: 0,
  type: 'internal_notice',
};

/** Chama `getNotifications` e responde a requisição HTTP com os itens dados (a API real não manda `replies` vazio). */
async function list(
  status: 'pending' | 'resolved',
  cursor: string | null = null,
  items: object[] = [REAL],
): Promise<NotificationPage> {
  const api = TestBed.inject(ProvisionalNotificationsApiService);
  const done = firstValueFrom(api.getNotifications(1, status, cursor, 50));
  const req = TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/v1/notifications'));

  expect(req.request.params.get('status')).toBe(status);
  req.flush({ items, nextCursor: null, unreadCount: 0 });

  return done;
}

describe('Provisional notification APIs', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [...PROVIDERS] }));

  it('a lista vem da API real; `replies` ausente vira lista vazia', async () => {
    const page = await list('pending');

    expect(page.items.filter(n => n.id > 0).map(n => n.id)).toEqual([3]);
    expect(page.items.find(n => n.id === 3)?.replies).toEqual([]);
  });

  it('remetente vê a mensagem que enviou no Hub, com estado e respostas; reflete resposta e reabertura', async () => {
    const store = TestBed.inject(ProvisionalPatientMessages);
    const mine = async (status: 'pending' | 'resolved'): Promise<{ description: string }[]> =>
      (await list(status)).items.filter(n => n.id < 0);

    expect((await mine('pending'))[0].description).toContain('Ativa · sem resposta');
    expect(await mine('resolved')).toEqual([]);

    await store.reply({
      at: '2026-11-22T10:00:00.000Z',
      author: 'Ana',
      origin: 'text',
      text: 'ok',
      threadId: 'thread-2',
    });

    expect((await mine('pending'))[0].description).toContain('Ativa · 1 resposta');
  });

  it('resolver a mensagem enviada grava no registro único da thread, visível no Hub e nas notificações', async () => {
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const store = TestBed.inject(ProvisionalPatientMessages);

    await firstValueFrom(api.resolve(-2));

    const thread = (await store.list('p1')).find(t => t.id === 'thread-2');

    expect(thread?.resolved).toBeTrue();
    expect(thread?.statusChanges[0].author).toBe('Michelle Franklin');
    expect((await list('resolved', null, [])).items.some(n => n.id === -2)).toBeTrue();
    TestBed.inject(HttpTestingController).expectNone(r => r.url.endsWith('/resolve'));
  });

  it('páginas seguintes não repetem as mensagens do remetente', async () => {
    const first = await list('pending');
    const next = await list('pending', '1');

    expect(first.items.some(n => n.id < 0)).toBeTrue();
    expect(next.items.some(n => n.id < 0)).toBeFalse();
    expect(next.items.map(n => n.id)).toEqual([3]);
  });

  it('quem não é o remetente não recebe a entrada', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ...PROVIDERS.slice(0, 5),
        { provide: PatientMessagesWriter, useExisting: ProvisionalPatientMessages },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): object => ({ name: 'Outra Pessoa', role: 'other' }) },
        },
      ],
    });

    expect((await list('pending')).items.some(n => n.id < 0)).toBeFalse();
  });

  it('createReply chama a API real e devolve a resposta', async () => {
    const api = TestBed.inject(ProvisionalNotificationsApiService);

    const done = firstValueFrom(api.createReply(3, 'feito'));
    const req = TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/notifications/3/replies'));

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'feito' });
    req.flush({ author: REAL.author, createdAt: '2026-11-24T10:00:00.000Z', id: 99, text: 'feito' });

    expect((await done).text).toBe('feito');
  });

  it('createReply de thread enviada pelo Hub (id negativo) não chama a API', async () => {
    const api = TestBed.inject(ProvisionalNotificationsApiService);

    const reply = await firstValueFrom(api.createReply(-1, 'ok'));

    expect(reply.text).toBe('ok');
    TestBed.inject(HttpTestingController).expectNone(r => r.url.includes('/replies'));
  });

  it('resolve chama a API real', async () => {
    const api = TestBed.inject(ProvisionalNotificationsApiService);

    const done = firstValueFrom(api.resolve(3));
    const req = TestBed.inject(HttpTestingController).expectOne(r => r.url.endsWith('/notifications/3/resolve'));

    expect(req.request.method).toBe('POST');
    req.flush(null);
    await done;
  });
});
