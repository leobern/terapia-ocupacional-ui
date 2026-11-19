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
    api.getNotifications(3, 'pending', null).subscribe();
    const first = http.expectOne(r => r.url.endsWith('/v1/notifications'));

    expect(first.request.params.get('hospitalId')).toBe('3');
    expect(first.request.params.get('status')).toBe('pending');
    expect(first.request.params.get('limit')).toBe('10');
    expect(first.request.params.has('cursor')).toBeFalse();
    first.flush({});

    api.getNotifications(3, 'resolved', 'xyz', 20).subscribe();
    const second = http.expectOne(r => r.url.endsWith('/v1/notifications'));

    expect(second.request.params.get('cursor')).toBe('xyz');
    expect(second.request.params.get('limit')).toBe('20');
    second.flush({});
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
});
