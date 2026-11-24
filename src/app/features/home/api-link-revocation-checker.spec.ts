import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiLinkRevocationChecker } from './api-link-revocation-checker';

describe('ApiLinkRevocationChecker', () => {
  let checker: ApiLinkRevocationChecker;
  let http: HttpTestingController;

  const items = [
    { hospitalId: 1, status: 'REVOGADO' },
    { hospitalId: 2, status: 'APROVADO' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiLinkRevocationChecker, provideHttpClient(), provideHttpClientTesting()],
    });
    checker = TestBed.inject(ApiLinkRevocationChecker);
    http = TestBed.inject(HttpTestingController);
  });

  it('is true when the link with the hospital is REVOGADO', async () => {
    const result = checker.isRevoked(1);

    http.expectOne(r => r.url.endsWith('/v1/vinculos')).flush({ hasApprovedLink: true, items });

    expect(await result).toBeTrue();
  });

  it('is false when the link is still APROVADO', async () => {
    const result = checker.isRevoked(2);

    http.expectOne(r => r.url.endsWith('/v1/vinculos')).flush({ hasApprovedLink: true, items });

    expect(await result).toBeFalse();
  });

  it('is false when the hospital is not in the list', async () => {
    const result = checker.isRevoked(99);

    http.expectOne(r => r.url.endsWith('/v1/vinculos')).flush({ hasApprovedLink: true, items });

    expect(await result).toBeFalse();
  });

  it('is false when the request fails', async () => {
    const result = checker.isRevoked(1);

    http.expectOne(r => r.url.endsWith('/v1/vinculos')).flush({ message: 'x' }, { status: 500, statusText: 'err' });

    expect(await result).toBeFalse();
  });
});
