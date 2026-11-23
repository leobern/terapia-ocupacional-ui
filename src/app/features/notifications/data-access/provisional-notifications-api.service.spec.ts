import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { ProvisionalUserDirectory } from '../../../shared/services/provisional-user-directory';
import { UserDirectory } from '../../../shared/services/user-directory';
import { NotificationsRepository } from './notifications-repository.service';
import { ProvisionalNotificationsApiService } from './provisional-notifications-api.service';

describe('Provisional notification APIs', () => {
  it('reads pages from the in-memory repository', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), ProvisionalNotificationsApiService] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);

    const page = await firstValueFrom(api.getNotifications(1, 'pending', null, 2));

    expect(page.items.length).toBe(2);
    expect(page.totalCount).toBe(TestBed.inject(NotificationsRepository).list('pending', null, 50).totalCount);
  });

  it('usa o tamanho de lote padrão (10) quando o limite não é informado', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), ProvisionalNotificationsApiService] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const repository = TestBed.inject(NotificationsRepository);
    const page = await firstValueFrom(api.getNotifications(1, 'resolved', null));

    expect(page.items.length).toBe(Math.min(10, repository.list('resolved', null, 50).totalCount));
  });

  it('createReply records the reply', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), ProvisionalNotificationsApiService] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const target = TestBed.inject(NotificationsRepository).list('pending', null, 1).items[0];

    const reply = await firstValueFrom(api.createReply(target.id, 'feito'));

    expect(reply.text).toBe('feito');
  });

  it('resolve move a notificação para Resolvidas', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), ProvisionalNotificationsApiService] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const repository = TestBed.inject(NotificationsRepository);
    const target = repository.list('pending', null, 1).items[0];
    const resolvedBefore = repository.list('resolved', null, 50).totalCount;

    await firstValueFrom(api.resolve(target.id));

    expect(repository.list('resolved', null, 50).totalCount).toBe(resolvedBefore + 1);
    expect(repository.list('pending', null, 50).items.some(n => n.id === target.id)).toBeFalse();
  });

  it('createAnnouncement cria o comunicado com os destinatários resolvidos pelos ids', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        ProvisionalNotificationsApiService,
        { provide: UserDirectory, useClass: ProvisionalUserDirectory },
      ],
    });
    const api = TestBed.inject(ProvisionalNotificationsApiService);

    const created = await firstValueFrom(api.createAnnouncement(1, 'Aviso', [2, 3]));

    expect(created.description).toBe('Aviso');
    expect(created.patient).toBeNull();
    expect(created.recipients?.map(r => r.id)).toEqual([2, 3]);
  });

  it('createAnnouncement resolve grupo por perfil e @todos sem duplicar pessoas', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        ProvisionalNotificationsApiService,
        { provide: UserDirectory, useClass: ProvisionalUserDirectory },
      ],
    });
    const api = TestBed.inject(ProvisionalNotificationsApiService);

    const medicos = await firstValueFrom(api.createAnnouncement(1, 'Aviso', [1], ['medicos']));
    const todos = await firstValueFrom(api.createAnnouncement(1, 'Aviso', [], [null]));

    expect(medicos.recipients?.map(r => r.id)).toEqual([1, 4]);
    expect(todos.recipients?.length).toBe(6);
  });
});
