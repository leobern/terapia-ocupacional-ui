import { HttpMfaGateway } from './http-mfa-gateway';

describe('HttpMfaGateway', () => {
  const gateway = new HttpMfaGateway();
  let fetchSpy: jasmine.Spy;

  const respond = (status: number, body?: unknown): void => {
    fetchSpy.and.resolveTo(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  };

  beforeEach(() => {
    spyOn(window, 'fetch');
    fetchSpy = window.fetch as jasmine.Spy;
  });

  it('verify envia o desafio e o código e devolve os tokens', async () => {
    respond(200, { accessToken: 'a', refreshToken: 'r' });

    const result = await gateway.verify('desafio', '123456');
    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];

    expect(url).toBe('/api/v1/auth/mfa/verificar');
    expect(JSON.parse(init.body as string)).toEqual({ codigo: '123456', mfaToken: 'desafio' });
    expect(result).toEqual({
      kind: 'success',
      recoveryCodes: undefined,
      tokens: { accessToken: 'a', refreshToken: 'r' },
    });
  });

  it('recover usa o endpoint de recuperação', async () => {
    respond(200, { accessToken: 'a', refreshToken: 'r' });

    await gateway.recover('desafio', 'AAAA-BBBB');
    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];

    expect(url).toBe('/api/v1/auth/mfa/recuperar');
    expect(JSON.parse(init.body as string)).toEqual({ codigoRecuperacao: 'AAAA-BBBB', mfaToken: 'desafio' });
  });

  it('confirmSetup devolve também os códigos de recuperação', async () => {
    respond(200, { accessToken: 'a', codigosRecuperacao: ['X1', 'X2'], refreshToken: 'r' });

    const result = await gateway.confirmSetup('desafio', '654321');

    expect(fetchSpy.calls.mostRecent().args[0]).toBe('/api/v1/auth/mfa/confirmar');
    expect(result).toEqual({
      kind: 'success',
      recoveryCodes: ['X1', 'X2'],
      tokens: { accessToken: 'a', refreshToken: 'r' },
    });
  });

  it('mapeia os status de erro', async () => {
    respond(400);

    expect((await gateway.verify('d', '1')).kind).toBe('invalid-code');
    respond(401);

    expect((await gateway.verify('d', '1')).kind).toBe('invalid-code');
    respond(410);

    expect((await gateway.verify('d', '1')).kind).toBe('expired');
    respond(423);

    expect((await gateway.verify('d', '1')).kind).toBe('locked');
    respond(500);

    expect((await gateway.verify('d', '1')).kind).toBe('network-error');
  });

  it('200 sem tokens e falha de transporte viram network-error', async () => {
    respond(200, {});

    expect((await gateway.verify('d', '1')).kind).toBe('network-error');
    fetchSpy.and.rejectWith(new Error('offline'));

    expect((await gateway.verify('d', '1')).kind).toBe('network-error');
  });

  it('beginSetup devolve segredo e link; falhas viram null', async () => {
    respond(200, { otpauthUri: 'otpauth://totp/x', segredo: 'ABCDEFGH' });

    expect(await gateway.beginSetup('d')).toEqual({ otpauthUri: 'otpauth://totp/x', secret: 'ABCDEFGH' });
    respond(200, {});

    expect(await gateway.beginSetup('d')).toBeNull();
    respond(500);

    expect(await gateway.beginSetup('d')).toBeNull();
    fetchSpy.and.rejectWith(new Error('offline'));

    expect(await gateway.beginSetup('d')).toBeNull();
  });
});
