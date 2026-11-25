import { HttpTokenRefresher } from './http-token-refresher';
import { RefreshRejectedError } from './token-refresher';

describe('HttpTokenRefresher', () => {
  const refresher = new HttpTokenRefresher();
  let fetchSpy: jasmine.Spy;

  function respond(status: number, body?: unknown): void {
    fetchSpy.and.resolveTo(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  }

  beforeEach(() => {
    spyOn(window, 'fetch');
    fetchSpy = window.fetch as jasmine.Spy;
  });

  it('posts the refresh token to the renewal endpoint', async () => {
    respond(200, { accessToken: 'a2', refreshToken: 'r2' });

    await refresher.refresh('r1');

    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];

    expect(url).toBe('/api/v1/auth/token/renovar');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'r1' });
  });

  it('returns the rotated tokens on 200', async () => {
    respond(200, { accessToken: 'a2', refreshToken: 'r2', tokenType: 'Bearer' });

    expect(await refresher.refresh('r1')).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
  });

  it('rejects definitively on 401 and 400', async () => {
    respond(401, { message: 'inválido' });
    await expectAsync(refresher.refresh('r1')).toBeRejectedWithError(RefreshRejectedError);

    respond(400);
    await expectAsync(refresher.refresh('r1')).toBeRejectedWithError(RefreshRejectedError);
  });

  it('keeps the session on other statuses (transient failure)', async () => {
    respond(503);

    const error = await refresher.refresh('r1').catch((e: unknown) => e);

    expect(error instanceof RefreshRejectedError).toBeFalse();
    expect(error).toEqual(jasmine.any(Error));
  });

  it('keeps the session on an incomplete 200 body', async () => {
    respond(200, { accessToken: 'a2' });

    const error = await refresher.refresh('r1').catch((e: unknown) => e);

    expect(error instanceof RefreshRejectedError).toBeFalse();
    expect(error).toEqual(jasmine.any(Error));
  });

  it('keeps the session on network failure', async () => {
    fetchSpy.and.rejectWith(new TypeError('offline'));

    const error = await refresher.refresh('r1').catch((e: unknown) => e);

    expect(error instanceof RefreshRejectedError).toBeFalse();
  });
});
