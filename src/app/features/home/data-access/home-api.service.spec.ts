import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HomeApiService } from './home-api.service';

describe('HomeApiService', () => {
  let api: HomeApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(HomeApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getSummary: GET /v1/home/summary com o hospital', () => {
    api.getSummary(7).subscribe();
    const req = http.expectOne(r => r.url.endsWith('/v1/home/summary'));

    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('hospitalId')).toBe('7');
    req.flush({});
  });

  it('getNotifications: GET /v1/home/notifications, com cursor só quando informado', () => {
    api.getNotifications(7, null).subscribe();
    const first = http.expectOne(r => r.url.endsWith('/v1/home/notifications'));

    expect(first.request.params.has('cursor')).toBeFalse();
    expect(first.request.params.get('limit')).toBe('10');
    first.flush({});

    api.getNotifications(7, 'abc', 5).subscribe();
    const second = http.expectOne(r => r.url.endsWith('/v1/home/notifications'));

    expect(second.request.params.get('cursor')).toBe('abc');
    expect(second.request.params.get('limit')).toBe('5');
    second.flush({});
  });

  it('getHospitals: GET /v1/home/hospitals', () => {
    api.getHospitals().subscribe();
    const req = http.expectOne(r => r.url.endsWith('/v1/home/hospitals'));

    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
