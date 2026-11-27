import { HttpInviteGateway } from './http-invite-gateway';

describe('HttpInviteGateway', () => {
  const gateway = new HttpInviteGateway();
  let fetchSpy: jasmine.Spy;

  const respond = (status: number): void => {
    fetchSpy.and.resolveTo(new Response(null, { status }));
  };

  beforeEach(() => {
    spyOn(window, 'fetch');
    fetchSpy = window.fetch as jasmine.Spy;
  });

  it('envia token, nome e senha ao endpoint de aceite', async () => {
    respond(204);

    await gateway.accept('tok', 'Ana Silva', 'Senha12345');

    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];

    expect(url).toBe('/api/v1/auth/convites/aceitar');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      nomeCompleto: 'Ana Silva',
      senha: 'Senha12345',
      token: 'tok',
    });
  });

  it('mapeia 2xx para ok, 400/404/410 para token inválido e 409 para já cadastrado', async () => {
    respond(204);

    expect(await gateway.accept('t', 'n', 'p')).toBe('ok');
    respond(400);

    expect(await gateway.accept('t', 'n', 'p')).toBe('invalid-token');
    respond(404);

    expect(await gateway.accept('t', 'n', 'p')).toBe('invalid-token');
    respond(410);

    expect(await gateway.accept('t', 'n', 'p')).toBe('invalid-token');
    respond(409);

    expect(await gateway.accept('t', 'n', 'p')).toBe('already-registered');
  });

  it('rejeita em erro de servidor', async () => {
    respond(500);

    await expectAsync(gateway.accept('t', 'n', 'p')).toBeRejected();
  });
});
