import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AdministrationApi } from './administration-api';

describe('AdministrationApi', () => {
  let api: AdministrationApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(AdministrationApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function call<T>(
    promise: Promise<T>,
    method: string,
    url: string,
    body?: unknown,
    response: object = {},
  ): Promise<T> {
    const req = http.expectOne(r => r.url === url);

    expect(req.request.method).toBe(method);
    if (body !== undefined) {
      expect(req.request.body).toEqual(body);
    }
    req.flush(response);

    return promise;
  }

  it('lista a equipe só com os filtros preenchidos', async () => {
    const promise = api.listTeam({ busca: 'ana', hospitalId: 2, papel: '', situacao: undefined });
    const req = http.expectOne(r => r.url === '/api/v1/admin/equipe');

    expect(req.request.params.keys().sort((a, b) => a.localeCompare(b))).toEqual(['busca', 'hospitalId']);
    expect(req.request.params.get('hospitalId')).toBe('2');
    req.flush([]);

    expect(await promise).toEqual([]);
  });

  it('lista a equipe sem filtros', async () => {
    const promise = api.listTeam();

    http.expectOne('/api/v1/admin/equipe').flush([]);

    expect(await promise).toEqual([]);
  });

  it('detalhe e interações da pessoa', async () => {
    expect(await call(api.personDetail(7), 'GET', '/api/v1/admin/equipe/7')).toBeTruthy();
    expect(await call(api.personInteractions(7), 'GET', '/api/v1/admin/equipe/7/interacoes', undefined, [])).toEqual(
      [],
    );
  });

  it('vincula, remove vínculo, desativa, reativa e muda o papel', async () => {
    const results = [
      await call(api.link(7, 3, 'GESTOR'), 'POST', '/api/v1/admin/equipe/7/vinculos', {
        hospitalId: 3,
        papelHospital: 'GESTOR',
      }),
      await call(api.unlink(7, 3), 'DELETE', '/api/v1/admin/equipe/7/vinculos/3'),
      await call(api.deactivate(7), 'PATCH', '/api/v1/admin/equipe/7/desativar', {}),
      await call(api.reactivate(7), 'PATCH', '/api/v1/admin/equipe/7/reativar', {}),
      await call(api.changeRole(7, 'MEDICO'), 'PATCH', '/api/v1/admin/equipe/7/papel', { papel: 'MEDICO' }),
    ];

    expect(results.length).toBe(5);
  });

  it('convida, reenvia e cancela convites', async () => {
    const body = { email: 'a@b.com', hospitalIds: [1], papel: 'MEDICO' as const };

    const sent = await call(api.invite(body), 'POST', '/api/v1/admin/convites', body);
    const again = await call(api.resendInvite(4), 'POST', '/api/v1/admin/convites/4/reenviar', null);
    const gone = await call(api.cancelInvite(4), 'DELETE', '/api/v1/admin/convites/4');

    expect([sent, again, gone]).toEqual([{}, {}, {}]);
  });

  it('cadastra, edita e ativa/inativa hospitais', async () => {
    const list = await call(api.listHospitals(), 'GET', '/api/v1/admin/hospitais', undefined, []);
    const created = await call(api.createHospital('H', 'Rua'), 'POST', '/api/v1/admin/hospitais', {
      endereco: 'Rua',
      nome: 'H',
    });
    const updated = await call(api.updateHospital(2, 'H2', 'R2'), 'PUT', '/api/v1/admin/hospitais/2', {
      endereco: 'R2',
      nome: 'H2',
    });
    const off = await call(api.setHospitalActive(2, false), 'PATCH', '/api/v1/admin/hospitais/2/inativar', {});
    const on = await call(api.setHospitalActive(2, true), 'PATCH', '/api/v1/admin/hospitais/2/reativar', {});

    expect(list).toEqual([]);
    expect([created, updated, off, on]).toEqual([{}, {}, {}, {}] as never);
  });

  it('lê e salva o meu perfil e as minhas interações', async () => {
    const edit = { especialidade: 'E', nomeCompleto: 'N', registroProfissional: 'R', telefone: 'T' };

    const mine = await call(api.myProfile(), 'GET', '/api/v1/perfil/me');
    const saved = await call(api.saveProfile(edit), 'PUT', '/api/v1/perfil/me', edit);
    const feed = await call(api.myInteractions(), 'GET', '/api/v1/perfil/me/interacoes', undefined, []);

    expect([mine, saved]).toEqual([{}, {}] as never);
    expect(feed).toEqual([]);
  });
});
