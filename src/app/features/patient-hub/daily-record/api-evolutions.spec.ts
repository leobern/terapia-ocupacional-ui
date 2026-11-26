import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  EvolucaoDiariaDto,
  EvolutionsApi,
  toDailyEvolution,
  toParameterEntries,
  toParametroDto,
} from './api-evolutions';

const dto = (extra: Partial<EvolucaoDiariaDto> = {}): EvolucaoDiariaDto => ({
  at: '2026-11-25T10:00:00-03:00',
  author: 'Dra. Ana',
  date: '2026-11-25',
  origin: 'AI_EDITED',
  parameters: [],
  reevaluations: [],
  text: 'Estável.',
  ...extra,
});

describe('mapeamentos de evoluções', () => {
  it('evolução: origem do servidor vira a da tela; dia sem texto e sem reavaliação é vazio', () => {
    const reevaluations = [{ dueAt: '2026-11-27T10:00:00Z', id: 'r1', name: 'Diarreia' }];

    expect(toDailyEvolution(dto({ reevaluations }))).toEqual({
      at: '2026-11-25T10:00:00-03:00',
      author: 'Dra. Ana',
      origin: 'ai-edited',
      reevaluations,
      text: 'Estável.',
    });
    expect(toDailyEvolution(dto({ text: '  ' }))).toBeNull();
    expect(toDailyEvolution(dto({ reevaluations, text: '' }))?.text).toBe('');
  });

  it('parâmetro: rótulo e unidade só quando existem', () => {
    expect(toParametroDto({ parameterId: 'glycemia', value: 130 })).toEqual({ parameterId: 'glycemia', value: 130 });
    expect(toParametroDto({ parameterId: 'custom:x', parameterLabel: 'X', unit: 'u', value: 1 })).toEqual({
      parameterId: 'custom:x',
      parameterLabel: 'X',
      unit: 'u',
      value: 1,
    });
  });

  it('lançamentos: id por posição, autor e hora da versão, nulos somem', () => {
    const entries = toParameterEntries(
      dto({
        parameters: [
          { parameterId: 'glycemia', parameterLabel: null, unit: null, value: 130 },
          { parameterId: 'custom:x', parameterLabel: 'X', unit: 'u', value: 2 },
        ],
      }),
    );

    expect(entries).toEqual([
      { at: '2026-11-25T10:00:00-03:00', author: 'Dra. Ana', id: '2026-11-25#0', parameterId: 'glycemia', value: 130 },
      {
        at: '2026-11-25T10:00:00-03:00',
        author: 'Dra. Ana',
        id: '2026-11-25#1',
        parameterId: 'custom:x',
        parameterLabel: 'X',
        unit: 'u',
        value: 2,
      },
    ]);
  });
});

describe('EvolutionsApi', () => {
  let api: EvolutionsApi;
  let http: HttpTestingController;
  const noContent = { status: 204, statusText: 'No Content' };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(EvolutionsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getDay: 200 devolve o corpo e 204 devolve null', async () => {
    const ok = api.getDay('7', '2026-11-25');

    http.expectOne('/api/v1/pacientes/7/evolucoes/2026-11-25').flush(dto());
    expect((await ok)?.text).toBe('Estável.');

    const empty = api.getDay('7', '2026-11-24');

    http.expectOne('/api/v1/pacientes/7/evolucoes/2026-11-24').flush(null, noContent);
    expect(await empty).toBeNull();
  });

  it('saveDay: PUT no dia com o corpo', async () => {
    const body = { origin: 'MANUAL' as const, parameters: [], reevaluations: [], text: 'x' };
    const result = api.saveDay('7', '2026-11-25', body);
    const req = http.expectOne('/api/v1/pacientes/7/evolucoes/2026-11-25');

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush(dto());
    expect((await result).author).toBe('Dra. Ana');
  });

  it('listPage: limit sempre e before só quando informado', async () => {
    const first = api.listPage('7', 30, null);
    const req = http.expectOne(r => r.url === '/api/v1/pacientes/7/evolucoes');

    expect(req.request.params.get('limit')).toBe('30');
    expect(req.request.params.has('before')).toBe(false);
    req.flush({ items: [], nextBefore: null });
    expect((await first).items).toEqual([]);

    const second = api.listPage('7', 5, '2026-11-01');
    const next = http.expectOne(r => r.url === '/api/v1/pacientes/7/evolucoes');

    expect(next.request.params.get('before')).toBe('2026-11-01');
    expect(next.request.params.get('limit')).toBe('5');
    next.flush({ items: [], nextBefore: null });
    await second;
  });
});
