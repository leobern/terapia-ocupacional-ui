import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { WelcomeApiService } from './welcome-api.service';

describe('WelcomeApiService', () => {
  let service: WelcomeApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WelcomeApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WelcomeApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads shouldShow and name', async () => {
    const result = service.getStatus();

    http.expectOne({ method: 'GET', url: '/api/v1/onboarding/welcome' }).flush({ name: 'Ana', shouldShow: true });

    expect(await result).toEqual({ name: 'Ana', shouldShow: true });
  });

  it('registers the completion with POST and accepts 204', async () => {
    const result = service.complete();

    http
      .expectOne({ method: 'POST', url: '/api/v1/onboarding/welcome/complete' })
      .flush(null, { status: 204, statusText: 'No Content' });

    await expectAsync(result).toBeResolved();
  });

  for (const status of [401, 403]) {
    it(`rejects the read on ${status} so the caller can fall back`, async () => {
      const result = service.getStatus();

      http
        .expectOne('/api/v1/onboarding/welcome')
        .flush({ message: 'x', timestamp: '2026-11-24T00:00:00Z' }, { status, statusText: 'err' });

      await expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ status }));
    });
  }

  it('rejects the completion on network failure', async () => {
    const result = service.complete();

    http.expectOne('/api/v1/onboarding/welcome/complete').error(new ProgressEvent('error'));

    await expectAsync(result).toBeRejected();
  });
});
