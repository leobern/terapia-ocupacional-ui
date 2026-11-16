import { HttpPasswordResetGateway } from './http-password-reset-gateway';

describe('HttpPasswordResetGateway', () => {
  const gateway = new HttpPasswordResetGateway();

  function respond(status: number): jasmine.Spy {
    const existing = (window.fetch as jasmine.Spy).and ? (window.fetch as jasmine.Spy) : spyOn(window, 'fetch');

    return existing.and.callFake(() => Promise.resolve(new Response(null, { status })));
  }

  it('posts the e-mail and maps 200 to sent', async () => {
    const spy = respond(200);

    expect(await gateway.requestReset('a@b.co')).toBe('sent');
    expect(spy.calls.mostRecent().args[0]).toContain('/auth/password-reset/request');
  });

  it('maps 404 on request to unknown-email', async () => {
    respond(404);

    expect(await gateway.requestReset('a@b.co')).toBe('unknown-email');
  });

  it('rejects on server error', async () => {
    respond(500);

    await expectAsync(gateway.requestReset('a@b.co')).toBeRejected();
    await expectAsync(gateway.confirmReset('t', 'p')).toBeRejected();
  });

  it('maps confirm responses', async () => {
    respond(200);

    expect(await gateway.confirmReset('t', 'p')).toBe('ok');

    respond(400);

    expect(await gateway.confirmReset('t', 'p')).toBe('invalid-token');

    respond(404);

    expect(await gateway.confirmReset('t', 'p')).toBe('invalid-token');

    respond(410);

    expect(await gateway.confirmReset('t', 'p')).toBe('invalid-token');
  });
});
