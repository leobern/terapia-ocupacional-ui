import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NotificationsApiService } from './notifications-api.service';

describe('NotificationsApiService', () => {
  let api: NotificationsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(NotificationsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getNotifications: hospital, status e limite; cursor só quando informado', () => {
    let page: { items: { replies: unknown[] }[] } | undefined;

    api.getNotifications(3, 'pending', null).subscribe(result => (page = result as never));
    const first = http.expectOne(r => r.url.endsWith('/v1/notifications'));

    expect(first.request.params.get('hospitalId')).toBe('3');
    expect(first.request.params.get('status')).toBe('pending');
    expect(first.request.params.get('limit')).toBe('10');
    expect(first.request.params.has('cursor')).toBeFalse();
    first.flush({ items: [{ id: 1 }, { id: 2, replies: [{ id: 7 }] }], nextCursor: null });
    // O servidor omite `replies` vazio: a tela sempre recebe uma lista.
    expect(page?.items.map(item => item.replies.length)).toEqual([0, 1]);

    api.getNotifications(3, 'resolved', 'xyz', 20).subscribe();
    const second = http.expectOne(r => r.url.endsWith('/v1/notifications'));

    expect(second.request.params.get('cursor')).toBe('xyz');
    expect(second.request.params.get('limit')).toBe('20');
    second.flush({ items: [], nextCursor: null });
  });

  it('createReply: POST /v1/notifications/:id/replies com o texto', () => {
    api.createReply(9, 'feito').subscribe();
    const req = http.expectOne(r => r.url.endsWith('/v1/notifications/9/replies'));

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'feito' });
    req.flush({});
  });

  it('resolve: POST /v1/notifications/:id/resolve', () => {
    let done = false;

    api.resolve(9).subscribe(() => (done = true));
    const req = http.expectOne(r => r.url.endsWith('/v1/notifications/9/resolve'));

    expect(req.request.method).toBe('POST');
    req.flush(null);

    expect(done).toBeTrue();
  });

  it('markAsRead: PUT /v1/notifications/:id/read', () => {
    let done = false;

    api.markAsRead(9).subscribe(() => (done = true));
    const req = http.expectOne(r => r.url.endsWith('/v1/notifications/9/read'));

    expect(req.request.method).toBe('PUT');
    req.flush(null);

    expect(done).toBeTrue();
  });
});
