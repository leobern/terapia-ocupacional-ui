import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { ProfessionalProfileReader } from '../../home/professional-profile';
import { PatientMessagesSource, PatientMessagesWriter } from '../../patient-messages/patient-messages-source';
import { ProvisionalPatientMessages } from '../../patient-messages/provisional-patient-messages';
import { NotificationsRepository } from './notifications-repository.service';
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

describe('Provisional notification APIs', () => {
  it('remetente vê a mensagem que enviou no Hub, com estado e respostas; reflete resposta e reabertura', async () => {
    TestBed.configureTestingModule({ providers: [...PROVIDERS] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const store = TestBed.inject(ProvisionalPatientMessages);
    const mine = async (status: 'pending' | 'resolved'): Promise<{ description: string }[]> =>
      (await firstValueFrom(api.getNotifications(1, status, null, 50))).items.filter(n => n.id < 0);

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
    TestBed.configureTestingModule({ providers: [...PROVIDERS] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const store = TestBed.inject(ProvisionalPatientMessages);

    await firstValueFrom(api.resolve(-2));

    const thread = (await store.list('p1')).find(t => t.id === 'thread-2');

    expect(thread?.resolved).toBeTrue();
    expect(thread?.statusChanges[0].author).toBe('Michelle Franklin');
    const resolved = (await firstValueFrom(api.getNotifications(1, 'resolved', null, 50))).items;

    expect(resolved.some(n => n.id === -2)).toBeTrue();
  });

  it('páginas seguintes não repetem as mensagens do remetente, mas mantêm o total', async () => {
    TestBed.configureTestingModule({ providers: [...PROVIDERS] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const first = await firstValueFrom(api.getNotifications(1, 'pending', null, 1));
    const next = await firstValueFrom(api.getNotifications(1, 'pending', '1', 1));

    expect(first.items.some(n => n.id < 0)).toBeTrue();
    expect(next.items.some(n => n.id < 0)).toBeFalse();
    expect(next.totalCount).toBe(first.totalCount);
  });

  it('quem não é o remetente não recebe a entrada', async () => {
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
    const page = await firstValueFrom(
      TestBed.inject(ProvisionalNotificationsApiService).getNotifications(1, 'pending', null, 50),
    );

    expect(page.items.some(n => n.id < 0)).toBeFalse();
  });

  it('reads pages from the in-memory repository', async () => {
    TestBed.configureTestingModule({ providers: [...PROVIDERS] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);

    const page = await firstValueFrom(api.getNotifications(1, 'pending', null, 2));

    // A mensagem enviada no Hub entra além do limite da página do repositório (provisório), sem perder itens.
    expect(page.items.filter(n => n.id > 0).length).toBe(2);
    // +1: a mensagem enviada pelo profissional no Hub (provisório).
    expect(page.totalCount).toBe(TestBed.inject(NotificationsRepository).list('pending', null, 50).totalCount + 1);
  });

  it('usa o tamanho de lote padrão (10) quando o limite não é informado', async () => {
    TestBed.configureTestingModule({ providers: [...PROVIDERS] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const repository = TestBed.inject(NotificationsRepository);
    const page = await firstValueFrom(api.getNotifications(1, 'resolved', null));

    expect(page.items.length).toBe(Math.min(10, repository.list('resolved', null, 50).totalCount));
  });

  it('createReply records the reply', async () => {
    TestBed.configureTestingModule({ providers: [...PROVIDERS] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const target = TestBed.inject(NotificationsRepository).list('pending', null, 1).items[0];

    const done = firstValueFrom(api.createReply(target.id, 'feito'));
    const req = TestBed.inject(HttpTestingController).expectOne(r =>
      r.url.endsWith(`/notifications/${target.id}/replies`),
    );

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'feito' });
    req.flush({ author: target.author, createdAt: '2026-11-24T10:00:00.000Z', id: 99, text: 'feito' });

    expect((await done).text).toBe('feito');
    expect(
      TestBed.inject(NotificationsRepository)
        .list('pending', null, 50)
        .items.find(n => n.id === target.id)?.replyCount,
    ).toBe(target.replyCount + 1);
  });

  it('createReply reabre no espelho local a notificação resolvida', async () => {
    TestBed.configureTestingModule({ providers: [...PROVIDERS] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const repository = TestBed.inject(NotificationsRepository);
    const target = repository.list('resolved', null, 1).items[0];

    const done = firstValueFrom(api.createReply(target.id, 'voltei'));

    TestBed.inject(HttpTestingController)
      .expectOne(r => r.url.endsWith(`/notifications/${target.id}/replies`))
      .flush({ author: target.author, createdAt: '2026-11-24T10:00:00.000Z', id: 100, text: 'voltei' });
    await done;

    expect(repository.list('pending', null, 50).items.some(n => n.id === target.id)).toBeTrue();
    expect(repository.list('resolved', null, 50).items.some(n => n.id === target.id)).toBeFalse();
  });

  it('createReply de thread enviada pelo Hub (id negativo) não chama a API', async () => {
    TestBed.configureTestingModule({ providers: [...PROVIDERS] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);

    const reply = await firstValueFrom(api.createReply(-1, 'ok'));

    expect(reply.text).toBe('ok');
    TestBed.inject(HttpTestingController).expectNone(r => r.url.includes('/replies'));
  });

  it('resolve move a notificação para Resolvidas', async () => {
    TestBed.configureTestingModule({ providers: [...PROVIDERS] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const repository = TestBed.inject(NotificationsRepository);
    const target = repository.list('pending', null, 1).items[0];
    const resolvedBefore = repository.list('resolved', null, 50).totalCount;

    const done = firstValueFrom(api.resolve(target.id));
    const req = TestBed.inject(HttpTestingController).expectOne(r =>
      r.url.endsWith(`/notifications/${target.id}/resolve`),
    );

    expect(req.request.method).toBe('POST');
    req.flush(null);
    await done;

    expect(repository.list('resolved', null, 50).totalCount).toBe(resolvedBefore + 1);
    expect(repository.list('pending', null, 50).items.some(n => n.id === target.id)).toBeFalse();
  });
});
