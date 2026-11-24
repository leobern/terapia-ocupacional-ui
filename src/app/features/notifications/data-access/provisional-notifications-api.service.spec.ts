import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { NotificationsRepository } from './notifications-repository.service';
import { ProvisionalNotificationsApiService } from './provisional-notifications-api.service';

describe('Provisional notification APIs', () => {
  it('getNotifications e markAsRead usam o cliente HTTP real (x-implemented: true)', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ProvisionalNotificationsApiService],
    });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const http = TestBed.inject(HttpTestingController);

    api.getNotifications(1, 'pending', null).subscribe();
    http
      .expectOne(r => r.method === 'GET' && r.url.endsWith('/v1/notifications'))
      .flush({ items: [], nextCursor: null });
    api.markAsRead(7).subscribe();
    http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/v1/notifications/7/read')).flush(null);
    http.verify();
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
});
