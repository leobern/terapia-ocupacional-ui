import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HttpFormulasApi } from './http-formulas-api';

describe('HttpFormulasApi', () => {
  let api: HttpFormulasApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpFormulasApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(HttpFormulasApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('lista o catálogo do hospital convertendo categorias e atributos nulos', async () => {
    const promise = api.list(1);

    controller.expectOne('/api/v1/hospitais/1/formulas').flush([
      {
        categoria: 'SUPLEMENTO_ORAL',
        embalagem: 'Frasco 200 mL',
        fabricante: 'Fabricante Y',
        fibra: true,
        gluten: null,
        id: 7,
        kcalPorMl: 1.5,
        lactose: null,
        nome: 'Suplemento Y',
        padronizada: true,
        proteinaPorMl: null,
        sacarose: null,
        tipoApresentacao: 'Líquido',
        unidadeBase: 'ML',
        viaAdministracao: 'Oral',
      },
    ]);

    expect(await promise).toEqual([
      {
        category: 'suplemento-oral',
        fiber: true,
        gluten: null,
        id: '7',
        kcalPerMl: 1.5,
        lactose: null,
        manufacturer: 'Fabricante Y',
        name: 'Suplemento Y',
        packaging: 'Frasco 200 mL',
        presentation: 'Líquido',
        proteinPerMl: null,
        route: 'Oral',
        standardized: true,
        sucrose: null,
        unit: 'ml',
      },
    ]);
  });

  it('campo que o backend omite vira null, nunca "Não" nem undefined', async () => {
    const promise = api.list(1);

    controller
      .expectOne('/api/v1/hospitais/1/formulas')
      .flush([{ categoria: 'ESPESSANTE', id: 3, nome: 'Espessante Z', padronizada: false, unidadeBase: 'G' }]);

    expect(await promise).toEqual([
      {
        category: 'espessante',
        fiber: null,
        gluten: null,
        id: '3',
        kcalPerMl: null,
        lactose: null,
        manufacturer: null,
        name: 'Espessante Z',
        packaging: null,
        presentation: null,
        proteinPerMl: null,
        route: null,
        standardized: false,
        sucrose: null,
        unit: 'g',
      },
    ]);
  });

  it('lista as padronizadas do hospital do paciente real (endpoint de leitura do profissional)', async () => {
    const promise = api.listStandardizedForPatient('42', 1);

    controller.expectOne('/api/v1/pacientes/42/formulas-padronizadas').flush([
      {
        categoria: 'ENTERAL',
        fibra: false,
        gluten: false,
        id: 9,
        kcalPorMl: 1,
        lactose: false,
        nome: 'Polimérica',
        padronizada: true,
        proteinaPorMl: 0.04,
        sacarose: false,
        unidadeBase: 'ML',
      },
    ]);

    expect(await promise).toEqual([jasmine.objectContaining({ category: 'enteral', id: '9', standardized: true })]);
  });

  it('paciente de exemplo usa o provisório, sem chamar a API', async () => {
    expect(await api.listStandardizedForPatient('p1', 1)).toEqual([]);
  });

  it('padroniza com PUT no hospital informado', async () => {
    const promise = api.setStandardized(2, '7', true);
    const request = controller.expectOne('/api/v1/hospitais/2/formulas/7/padronizacao');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ padronizada: true });
    request.flush({});
    await promise;
  });

  it('lista os pedidos do hospital', async () => {
    const promise = api.listRequests(1);

    controller
      .expectOne('/api/v1/hospitais/1/solicitacoes-formula')
      .flush([{ createdAt: '2026-11-28T10:00:00', descricao: 'Fórmula Z', id: 4 }]);

    expect(await promise).toEqual([{ createdAt: '2026-11-28T10:00:00', description: 'Fórmula Z', id: '4' }]);
  });

  it('pedidos de hospital só do aparelho ficam no provisório', async () => {
    const hospitalId = -5;

    await api.requestFormula(hospitalId, 'Primeira');
    await api.requestFormula(hospitalId, 'Segunda');

    expect((await api.listRequests(hospitalId)).map(r => r.description)).toEqual(['Segunda', 'Primeira']);
  });

  it('solicita fórmula nova com POST', async () => {
    const promise = api.requestFormula(1, 'Fórmula Z');
    const request = controller.expectOne('/api/v1/hospitais/1/solicitacoes-formula');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ descricao: 'Fórmula Z' });
    request.flush({});
    await promise;
  });

  it('hospital cadastrado só no aparelho (id negativo) usa o provisório, sem chamar a API', async () => {
    const hospitalId = -1700000000000;
    const catalog = await api.list(hospitalId);

    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog.every(formula => !formula.standardized)).toBeTrue();

    await api.setStandardized(hospitalId, catalog[0].id, true);
    await api.requestFormula(hospitalId, 'Fórmula Z');

    expect((await api.list(hospitalId)).filter(formula => formula.standardized).length).toBe(1);
  });

  it('hospital de exemplo não numérico não chega na API', async () => {
    expect((await api.list(Number.NaN)).length).toBeGreaterThan(0);
  });
});
