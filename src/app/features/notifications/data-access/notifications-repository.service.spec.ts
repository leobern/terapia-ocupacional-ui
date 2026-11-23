import { TestBed } from '@angular/core/testing';

import { NotificationsRepository } from './notifications-repository.service';

describe('NotificationsRepository', () => {
  let repository: NotificationsRepository;

  beforeEach(() => {
    repository = TestBed.inject(NotificationsRepository);
  });

  it('paginates by cursor, newest first, with the total of that status', () => {
    const first = repository.list('resolved', null, 2);
    const second = repository.list('resolved', first.nextCursor, 2);

    expect(first.items.length).toBe(2);
    expect(first.totalCount).toBe(4);
    expect(first.nextCursor).toBe('2');
    expect(second.items.length).toBe(2);
    expect(second.nextCursor).toBeNull();
    expect(Date.parse(first.items[0].createdAt)).toBeGreaterThanOrEqual(Date.parse(first.items[1].createdAt));
  });

  it('create adds a pending notification by the signed-in professional, without patient, and bumps the version', () => {
    const before = repository.list('pending', null, 50).totalCount;
    const version = repository.version();

    const created = repository.create({ dueDate: '', message: 'Olá', recipients: [] });

    expect(created.patient).toBeNull();
    expect(created.author.name).toBe('Michelle Franklin');
    expect(repository.list('pending', null, 50).totalCount).toBe(before + 1);
    expect(repository.list('pending', null, 1).items[0].id).toBe(created.id);
    expect(repository.version()).toBe(version + 1);
  });

  it('addReply appends to the history and bumps the version', () => {
    const target =
      repository.list('pending', null, 50).items.find(n => n.replyCount === 0) ??
      repository.list('pending', null, 1).items[0];
    const version = repository.version();

    repository.addReply(target.id, 'ok');
    const updated = repository.list('pending', null, 50).items.find(n => n.id === target.id);

    expect(updated?.replyCount).toBe(target.replyCount + 1);
    expect(updated?.replies[updated.replies.length - 1].text).toBe('ok');
    expect(repository.version()).toBe(version + 1);
  });

  it('resolve move de Pendentes para Resolvidas e incrementa a versão', () => {
    const target = repository.list('pending', null, 1).items[0];
    const version = repository.version();

    repository.resolve(target.id);

    expect(repository.list('pending', null, 50).items.some(n => n.id === target.id)).toBeFalse();
    expect(repository.list('resolved', null, 50).items.some(n => n.id === target.id)).toBeTrue();
    expect(repository.version()).toBe(version + 1);
  });

  it('countUnread soma as não lidas de ativas e resolvidas; markAsRead diminui o total sem mudar a versão', () => {
    const total = repository.list('pending', null, 50).totalCount + repository.list('resolved', null, 50).totalCount;
    const version = repository.version();
    const [pending] = repository.list('pending', null, 1).items;
    const [resolved] = repository.list('resolved', null, 1).items;

    expect(repository.countUnread()).toBe(total);

    repository.markAsRead([pending.id, resolved.id]);
    repository.markAsRead([pending.id]);

    expect(repository.countUnread()).toBe(total - 2);
    expect(repository.list('pending', null, 50).items.find(n => n.id === pending.id)?.read).toBeTrue();
    expect(repository.version()).toBe(version);
  });
});
