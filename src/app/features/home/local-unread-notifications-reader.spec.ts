import { TestBed } from '@angular/core/testing';

import { NotificationsRepository } from '../notifications/data-access/notifications-repository.service';
import { LocalUnreadNotificationsReader } from './local-unread-notifications-reader';

describe('LocalUnreadNotificationsReader', () => {
  let reader: LocalUnreadNotificationsReader;
  let repository: NotificationsRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LocalUnreadNotificationsReader] });
    reader = TestBed.inject(LocalUnreadNotificationsReader);
    repository = TestBed.inject(NotificationsRepository);
  });

  it('conta as não lidas de ativas e resolvidas do repositório', async () => {
    const total = repository.list('pending', null, 50).totalCount + repository.list('resolved', null, 50).totalCount;

    expect(await reader.countUnread()).toBe(total);
  });

  it('diminui quando as notificações são vistas (marcadas como lidas)', async () => {
    const before = await reader.countUnread();

    repository.markAsRead([
      repository.list('pending', null, 1).items[0].id,
      repository.list('resolved', null, 1).items[0].id,
    ]);

    expect(await reader.countUnread()).toBe(before - 2);
  });

  it('acompanha as notificações criadas', async () => {
    const before = await reader.countUnread();

    repository.create({ message: 'Nova', recipients: [] });

    expect(await reader.countUnread()).toBe(before + 1);
  });
});
