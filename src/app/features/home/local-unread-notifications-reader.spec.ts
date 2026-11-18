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

  it('conta as notificações pendentes do repositório', async () => {
    expect(await reader.countUnread()).toBe(repository.list('pending', null, 50).totalCount);
  });

  it('acompanha as notificações criadas', async () => {
    const before = await reader.countUnread();

    repository.create({ dueDate: '', message: 'Nova', recipients: [] });

    expect(await reader.countUnread()).toBe(before + 1);
  });
});
