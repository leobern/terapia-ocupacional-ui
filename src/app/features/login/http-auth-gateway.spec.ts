import { HttpAuthGateway } from './http-auth-gateway';

describe('HttpAuthGateway', () => {
  const gateway = new HttpAuthGateway();
  let fetchSpy: jasmine.Spy;

  function respond(status: number, body?: unknown, headers: Record<string, string> = {}): void {
    fetchSpy.and.resolveTo(new Response(body === undefined ? null : JSON.stringify(body), { headers, status }));
  }

  beforeEach(() => {
    spyOn(window, 'fetch');
    fetchSpy = window.fetch as jasmine.Spy;
  });

  it('posts e-mail and password to the login endpoint', async () => {
    respond(200, { accessToken: 'a', refreshToken: 'r' });

    await gateway.login('a@b.co', 'pw');

    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];

    expect(url).toBe('/api/v1/auth/login');
    expect(init.method).toBe('POST');
    // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- valor de teste
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.co', password: 'pw' });
  });

  it('returns the tokens on 200', async () => {
    respond(200, { accessToken: 'a', refreshToken: 'r', tokenType: 'Bearer' });

    await expectAsync(gateway.login('a@b.co', 'pw')).toBeResolvedTo({
      kind: 'success',
      tokens: { accessToken: 'a', refreshToken: 'r' },
    });
  });

  it('maps 200 without tokens to network-error', async () => {
    respond(200, {});

    await expectAsync(gateway.login('a@b.co', 'pw')).toBeResolvedTo({ kind: 'network-error' });
  });

  it('maps 401 to invalid-credentials', async () => {
    respond(401, { message: 'x' });

    await expectAsync(gateway.login('a@b.co', 'pw')).toBeResolvedTo({ kind: 'invalid-credentials' });
  });

  it('maps 423 to locked, with Retry-After when informed', async () => {
    respond(423, { message: 'x' });
    await expectAsync(gateway.login('a@b.co', 'pw')).toBeResolvedTo({ kind: 'locked' });

    respond(423, { message: 'x' }, { 'Retry-After': '300' });
    await expectAsync(gateway.login('a@b.co', 'pw')).toBeResolvedTo({ kind: 'locked', retryAfterSeconds: 300 });
  });

  it('maps 5xx and transport failures to network-error', async () => {
    respond(500);
    await expectAsync(gateway.login('a@b.co', 'pw')).toBeResolvedTo({ kind: 'network-error' });

    fetchSpy.and.rejectWith(new TypeError('offline'));
    await expectAsync(gateway.login('a@b.co', 'pw')).toBeResolvedTo({ kind: 'network-error' });
  });
});
