import { TestBed } from '@angular/core/testing';

import { NotificationsRepository } from '../notifications/data-access/notifications-repository.service';
import { ProvisionalHomeNotificationsSource } from './provisional-home-notifications';

describe('ProvisionalHomeNotificationsSource', () => {
  let source: ProvisionalHomeNotificationsSource;
  let repository: NotificationsRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ProvisionalHomeNotificationsSource] });
    source = TestBed.inject(ProvisionalHomeNotificationsSource);
    repository = TestBed.inject(NotificationsRepository);
  });

  it('devolve as pendentes do repositório, da mais recente para a mais antiga', async () => {
    const page = await source.loadPage('x', null, 10);

    expect(page.items.length).toBe(repository.list('pending', null, 50).totalCount);
    expect(page.nextCursor).toBeNull();
    expect(Date.parse(page.items[0].createdAt)).toBeGreaterThanOrEqual(Date.parse(page.items[1].createdAt));
  });

  it('pagina por cursor', async () => {
    const first = await source.loadPage('x', null, 2);
    const second = await source.loadPage('x', first.nextCursor, 2);

    expect(first.items.length).toBe(2);
    expect(first.nextCursor).toBe('2');
    expect(second.items.length).toBe(1);
    expect(second.nextCursor).toBeNull();
  });

  it('o que é criado na tela de Notificações aparece no feed da Home', async () => {
    const created = repository.create({ dueDate: '', message: 'Nova', recipients: [] });
    const page = await source.loadPage('x', null, 10);

    expect(page.items[0].id).toBe(created.id);
  });

  it('usa os padrões quando chamada sem argumentos', async () => {
    expect((await source.loadPage()).items.length).toBeGreaterThan(0);
  });
});
