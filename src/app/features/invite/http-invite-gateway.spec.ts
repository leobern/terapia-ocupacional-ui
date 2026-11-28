import { HttpInviteGateway } from './http-invite-gateway';

describe('HttpInviteGateway', () => {
  const gateway = new HttpInviteGateway();
  let fetchSpy: jasmine.Spy;

  const respond = (status: number, body?: unknown): void => {
    fetchSpy.and.resolveTo(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  };

  beforeEach(() => {
    spyOn(window, 'fetch');
    fetchSpy = window.fetch as jasmine.Spy;
  });

  describe('accept', () => {
    it('envia token, nome, senha e foto ao endpoint de aceite', async () => {
      respond(201);

      await gateway.accept('tok', 'Ana Silva', 'Senha12345', { base64: 'AAAA', type: 'image/png' });

      const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];

      expect(url).toBe('/api/v1/auth/convites/aceitar');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        fotoBase64: 'AAAA',
        fotoTipo: 'image/png',
        nomeCompleto: 'Ana Silva',
        senha: 'Senha12345',
        token: 'tok',
      });
    });

    it('sem foto não manda os campos da foto', async () => {
      respond(201);

      await gateway.accept('tok', 'Ana', 'Senha12345');

      const [, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];

      expect(JSON.parse(init.body as string)).toEqual({ nomeCompleto: 'Ana', senha: 'Senha12345', token: 'tok' });
    });

    it('conta criada vira "ok"', async () => {
      respond(201);

      expect(await gateway.accept('t', 'A', 'S')).toBe('ok');
    });

    for (const status of [400, 404, 410]) {
      it(`HTTP ${status} vira "invalid-token"`, async () => {
        respond(status);

        expect(await gateway.accept('t', 'A', 'S')).toBe('invalid-token');
      });
    }

    it('HTTP 409 vira "already-registered"', async () => {
      respond(409);

      expect(await gateway.accept('t', 'A', 'S')).toBe('already-registered');
    });

    it('rejeita em outras falhas', async () => {
      respond(500);

      await expectAsync(gateway.accept('t', 'A', 'S')).toBeRejected();
    });
  });

  describe('check', () => {
    it('lê e-mail, papel e hospitais do convite', async () => {
      respond(200, { email: 'a@b.com', hospitais: ['H1'], papel: 'MEDICO' });

      expect(await gateway.check('abc def')).toEqual({ email: 'a@b.com', hospitals: ['H1'], role: 'MEDICO' });
      expect((fetchSpy.calls.mostRecent().args as string[])[0]).toBe('/api/v1/auth/convites/abc%20def');
    });

    it('sem lista de hospitais devolve lista vazia', async () => {
      respond(200, { email: 'a@b.com', papel: 'TERAPEUTA' });

      expect((await gateway.check('t'))?.hospitals).toEqual([]);
    });

    it('convite inválido vira null', async () => {
      respond(404);

      expect(await gateway.check('t')).toBeNull();
    });

    it('rejeita em falha inesperada', async () => {
      respond(503);

      await expectAsync(gateway.check('t')).toBeRejected();
    });
  });
});
