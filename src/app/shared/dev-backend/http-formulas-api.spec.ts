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
    const promise = api.list('1');

    controller.expectOne('/api/v1/hospitais/1/formulas').flush([
      {
        categoria: 'SUPLEMENTO_ORAL',
        fibra: true,
        gluten: null,
        id: 7,
        kcalPorMl: 1.5,
        lactose: null,
        nome: 'Suplemento Y',
        padronizada: true,
        proteinaPorMl: null,
        sacarose: null,
        vegano: null,
        vegetariano: true,
      },
    ]);

    expect(await promise).toEqual([
      {
        category: 'suplemento-oral',
        fiber: true,
        gluten: false,
        id: '7',
        kcalPerMl: 1.5,
        lactose: false,
        name: 'Suplemento Y',
        proteinPerMl: null,
        standardized: true,
        sucrose: false,
        vegan: false,
        vegetarian: true,
      },
    ]);
  });

  it('padroniza com PUT no hospital informado', async () => {
    const promise = api.setStandardized('2', '7', true);
    const request = controller.expectOne('/api/v1/hospitais/2/formulas/7/padronizacao');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ padronizada: true });
    request.flush({});
    await promise;
  });

  it('solicita fórmula nova com POST', async () => {
    const promise = api.requestFormula('1', 'Fórmula Z');
    const request = controller.expectOne('/api/v1/hospitais/1/solicitacoes-formula');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ descricao: 'Fórmula Z' });
    request.flush({});
    await promise;
  });

  it('rejeita hospital que não é numérico, sem chamar a API', async () => {
    await expectAsync(api.list('hospital-vila-nova-star')).toBeRejected();
  });
});
