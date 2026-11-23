import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { ProfessionalProfileReader } from '../../home/professional-profile';
import { PatientMessagesSource } from '../../patient-messages/patient-messages-source';
import { ProvisionalPatientMessages } from '../../patient-messages/provisional-patient-messages';
import { NotificationsRepository } from './notifications-repository.service';
import { ProvisionalNotificationsApiService } from './provisional-notifications-api.service';

const PROVIDERS = [
  provideHttpClient(),
  ProvisionalNotificationsApiService,
  ProvisionalPatientMessages,
  { provide: PatientMessagesSource, useExisting: ProvisionalPatientMessages },
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
        ...PROVIDERS.slice(0, 4),
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

    const reply = await firstValueFrom(api.createReply(target.id, 'feito'));

    expect(reply.text).toBe('feito');
  });

  it('resolve move a notificação para Resolvidas', async () => {
    TestBed.configureTestingModule({ providers: [...PROVIDERS] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const repository = TestBed.inject(NotificationsRepository);
    const target = repository.list('pending', null, 1).items[0];
    const resolvedBefore = repository.list('resolved', null, 50).totalCount;

    await firstValueFrom(api.resolve(target.id));

    expect(repository.list('resolved', null, 50).totalCount).toBe(resolvedBefore + 1);
    expect(repository.list('pending', null, 50).items.some(n => n.id === target.id)).toBeFalse();
  });
});
