import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiPlanSource, toTargets, toTargetsDto } from './api-plan-source';
import { NutritionTargets } from './plan-targets';
import { ProvisionalPlanSource } from './provisional-plan-source';

describe('ApiPlanSource', () => {
  let source: ApiPlanSource;
  let http: HttpTestingController;
  const plan = '/api/v1/pacientes/42/plano-nutricional';
  const base = { at: '2026-11-26T10:00:00-03:00', author: 'Dra. Ana' };
  const who = { at: 'ignorado', author: 'ignorado', patientId: '42' };
  const simplified: NutritionTargets = {
    calorimetry: null,
    formula: 'simplified',
    kcalPerDay: 1875,
    kcalPerKg: 25,
    proteinPerDay: 112.5,
    proteinPerKg: 1.5,
    referenceWeight: { kg: 75, kind: 'current' },
  };
  const calorimetry: NutritionTargets = {
    ...simplified,
    calorimetry: { kcal: 2000, percent: 70 },
    formula: 'indirect-calorimetry',
    kcalPerDay: 1400,
    referenceWeight: { kg: 62, kind: 'ideal' },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiPlanSource, ProvisionalPlanSource, provideHttpClient(), provideHttpClientTesting()],
    });
    source = TestBed.inject(ApiPlanSource);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Lê o plano devolvendo `body` (200) ou nada (204). */
  async function load<T>(call: () => Promise<T>, body: object | null): Promise<T> {
    const result = call();
    const req = http.expectOne(plan);

    expect(req.request.method).toBe('GET');
    if (body === null) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    } else {
      req.flush(body);
    }

    return result;
  }

  async function save<T>(call: () => Promise<T>, body: object, response: object): Promise<T> {
    const result = call();
    const req = http.expectOne(plan);

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush(response);

    return result;
  }

  it('204 deixa tudo vazio', async () => {
    expect(await load(() => source.loadRoute('42'), null)).toBeNull();
    expect(await load(() => source.loadSwallowing('42'), null)).toBeNull();
    expect(await load(() => source.loadReferenceWeight('42'), null)).toBeNull();
    expect(await load(() => source.loadTargets('42'), null)).toBeNull();
    expect(await load(() => source.loadCadence('42'), null)).toBeNull();
    expect(await load(() => source.loadResponsible('42'), null)).toBeNull();
  });

  it('plano com campos nulos também lê vazio', async () => {
    const empty = { ...base, routes: null, swallowing: null };

    expect(await load(() => source.loadRoute('42'), empty)).toBeNull();
    expect(await load(() => source.loadSwallowing('42'), empty)).toBeNull();
    expect(await load(() => source.loadCadence('42'), empty)).toBeNull();
  });

  it('lê via, deglutição, peso, metas, cadência e responsável', async () => {
    const full = {
      ...base,
      cadence: [5, 1, 3],
      referenceWeight: { kg: 70, kind: 'ADJUSTED' },
      responsible: 'Dr. Bruno',
      routes: ['VO', 'NE'],
      routesSince: '2026-11-20T08:00:00-03:00',
      swallowing: 'NEEDED',
      targets: {
        ...simplified,
        calorimetry: null,
        formula: 'SIMPLIFIED',
        referenceWeight: { kg: 75, kind: 'CURRENT' },
      },
    };

    expect(await load(() => source.loadRoute('42'), full)).toEqual({
      routes: ['VO', 'NE'],
      since: '2026-11-20T08:00:00-03:00',
    });

    expect(await load(() => source.loadSwallowing('42'), full)).toBe('needed');
    expect(await load(() => source.loadReferenceWeight('42'), full)).toEqual({ kg: 70, kind: 'adjusted' });
    expect(await load(() => source.loadTargets('42'), full)).toEqual(simplified);
    expect(await load(() => source.loadCadence('42'), full)).toEqual([1, 3, 5]);
    expect(await load(() => source.loadResponsible('42'), full)).toBe('Dr. Bruno');
  });

  it('via sem routesSince usa a data da versão', async () => {
    expect(await load(() => source.loadRoute('42'), { ...base, routes: ['NP'] })).toEqual({
      routes: ['NP'],
      since: base.at,
    });
  });

  it('grava a via mandando só routes e devolve o desde quando do servidor', async () => {
    expect(
      await save(
        () => source.saveRoute({ ...who, routes: ['VO', 'NE'] }),
        { routes: ['VO', 'NE'] },
        { ...base, routes: ['VO', 'NE'], routesSince: '2026-11-26T10:00:00-03:00' },
      ),
    ).toEqual({ routes: ['VO', 'NE'], since: '2026-11-26T10:00:00-03:00' });

    expect(await save(() => source.saveRoute({ ...who, routes: ['NE'] }), { routes: ['NE'] }, { ...base })).toEqual({
      routes: ['NE'],
      since: base.at,
    });
  });

  it('grava a deglutição', async () => {
    expect(
      await save(
        () => source.saveSwallowing({ ...who, decision: 'not-needed' }),
        { swallowing: 'NOT_NEEDED' },
        { ...base, swallowing: 'NOT_NEEDED' },
      ),
    ).toBe('not-needed');

    expect(
      await save(() => source.saveSwallowing({ ...who, decision: 'needed' }), { swallowing: 'NEEDED' }, { ...base }),
    ).toBe('needed');
  });

  it('grava o peso de referência', async () => {
    const weight = { kg: 62, kind: 'ideal' as const };

    expect(
      await save(
        () => source.saveReferenceWeight({ ...who, weight }),
        { referenceWeight: { kg: 62, kind: 'IDEAL' } },
        { ...base, referenceWeight: { kg: 62, kind: 'IDEAL' } },
      ),
    ).toEqual(weight);

    expect(
      await save(
        () => source.saveReferenceWeight({ ...who, weight: { kg: 70, kind: 'dry' } }),
        { referenceWeight: { kg: 70, kind: 'DRY' } },
        { ...base },
      ),
    ).toEqual({ kg: 70, kind: 'dry' });
  });

  it('grava as metas nas duas fórmulas; calorimetria só na indireta', async () => {
    const simplifiedDto = { ...simplified, formula: 'SIMPLIFIED', referenceWeight: { kg: 75, kind: 'CURRENT' } };
    const calorimetryDto = {
      ...calorimetry,
      formula: 'INDIRECT_CALORIMETRY',
      referenceWeight: { kg: 62, kind: 'IDEAL' },
    };
    const withoutCalorimetry = Object.fromEntries(
      Object.entries(simplifiedDto).filter(([key]) => key !== 'calorimetry'),
    );

    expect(
      await save(
        () => source.saveTargets({ ...who, targets: { ...simplified, calorimetry: { kcal: 1, percent: 1 } } }),
        { targets: withoutCalorimetry },
        { ...base, targets: { ...simplifiedDto, calorimetry: null } },
      ),
    ).toEqual(simplified);

    expect(
      await save(
        () => source.saveTargets({ ...who, targets: calorimetry }),
        { targets: calorimetryDto },
        { ...base, targets: calorimetryDto },
      ),
    ).toEqual(calorimetry);

    expect(
      await save(
        () => source.saveTargets({ ...who, targets: simplified }),
        { targets: withoutCalorimetry },
        { ...base },
      ),
    ).toEqual(simplified);
  });

  it('conversores de metas', () => {
    expect(toTargetsDto(calorimetry).calorimetry).toEqual({ kcal: 2000, percent: 70 });
    expect('calorimetry' in toTargetsDto(simplified)).toBeFalse();
    expect(toTargets(toTargetsDto(calorimetry))).toEqual(calorimetry);
  });

  it('grava a cadência normalizada (0 domingo a 6 sábado)', async () => {
    expect(
      await save(
        () => source.saveCadence({ ...who, days: [5, 1, 0, 1] }),
        { cadence: [1, 5, 0] },
        { ...base, cadence: [0, 1, 5] },
      ),
    ).toEqual([1, 5, 0]);

    expect(await save(() => source.saveCadence({ ...who, days: [2] }), { cadence: [2] }, { ...base })).toEqual([2]);
  });

  it('grava o responsável', async () => {
    expect(
      await save(
        () => source.saveResponsible({ ...who, name: 'Dra. Ana' }),
        { responsible: 'Dra. Ana' },
        { ...base, responsible: 'Dra. Ana' },
      ),
    ).toBe('Dra. Ana');

    expect(await save(() => source.saveResponsible({ ...who, name: 'X' }), { responsible: 'X' }, { ...base })).toBe(
      'X',
    );
  });

  it('lê e acrescenta sinalizações com id numérico virando texto; autor e hora do servidor', async () => {
    const list = source.loadConductFlags('42');
    const req = http.expectOne(`${plan}/sinalizacoes`);

    expect(req.request.method).toBe('GET');
    req.flush([{ at: base.at, author: 'Ana', id: 7, text: 'Piorou' }]);

    expect(await list).toEqual([{ at: base.at, author: 'Ana', id: '7', text: 'Piorou' }]);

    const added = source.addConductFlag({ ...who, text: 'Febre' });
    const post = http.expectOne(`${plan}/sinalizacoes`);

    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ text: 'Febre' });
    post.flush({ at: base.at, author: 'Ana', id: 8, text: 'Febre' }, { status: 201, statusText: 'Created' });

    expect(await added).toEqual({ at: base.at, author: 'Ana', id: '8', text: 'Febre' });
  });

  it('erros sobem', async () => {
    const read = source.loadTargets('42');

    http.expectOne(plan).flush({}, { status: 404, statusText: 'Not Found' });
    await expectAsync(read).toBeRejected();

    const write = source.saveResponsible({ ...who, name: 'X' });

    http.expectOne(plan).flush({}, { status: 400, statusText: 'Bad Request' });
    await expectAsync(write).toBeRejected();

    const flag = source.addConductFlag({ ...who, text: 'x' });

    http.expectOne(`${plan}/sinalizacoes`).flush({}, { status: 400, statusText: 'Bad Request' });
    await expectAsync(flag).toBeRejected();
  });

  it('peso atual vem da avaliação clínica; ideal, ajustado e seco não existem', async () => {
    const assessment = '/api/v1/pacientes/42/avaliacao-clinica';
    const withWeight = source.loadCalculatedWeights('42');

    http.expectOne(assessment).flush({ heightCm: 170, weightKg: 71.5 });

    expect(await withWeight).toEqual({ current: 71.5 });

    const withoutWeight = source.loadCalculatedWeights('42');

    http.expectOne(assessment).flush({ heightCm: null, weightKg: null });

    expect(await withoutWeight).toEqual({});

    const zero = source.loadCalculatedWeights('42');

    http.expectOne(assessment).flush({ heightCm: 170, weightKg: 0 });

    expect(await zero).toEqual({});

    const failed = source.loadCalculatedWeights('42');

    http.expectOne(assessment).flush({}, { status: 404, statusText: 'Not Found' });
    await expectAsync(failed).toBeRejected();
  });

  it('médicos seguem no provisório', async () => {
    expect((await source.loadResponsibleOptions()).length).toBeGreaterThan(0);
    http.expectNone(plan);
  });

  it('id de exemplo usa o provisório e não chama a API', async () => {
    expect((await source.loadRoute('p1'))?.routes).toEqual(['NE']);
    expect((await source.loadTargets('p1'))?.kcalPerDay).toBe(1875);
    expect((await source.loadCalculatedWeights('p1')).ideal).toBe(62);

    const at = '2026-11-26T09:00:00';
    const ex = { at, author: 'A', patientId: 'p-spec' };

    expect((await source.saveRoute({ ...ex, routes: ['VO'] })).routes).toEqual(['VO']);
    expect(await source.saveSwallowing({ ...ex, decision: 'needed' })).toBe('needed');
    expect(await source.loadSwallowing('p-spec')).toBe('needed');
    expect(await source.saveCadence({ ...ex, days: [1] })).toEqual([1]);
    expect(await source.loadCadence('p-spec')).toEqual([1]);
    expect(await source.saveResponsible({ ...ex, name: 'Dr. Bruno' })).toBe('Dr. Bruno');
    expect(await source.loadResponsible('p-spec')).toBe('Dr. Bruno');
    expect((await source.saveReferenceWeight({ ...ex, weight: { kg: 60, kind: 'dry' } })).kg).toBe(60);
    expect((await source.loadReferenceWeight('p-spec'))?.kind).toBe('dry');
    expect((await source.saveTargets({ ...ex, targets: simplified })).kcalPerDay).toBe(1875);
    expect(await source.loadConductFlags('p-spec')).toEqual([]);
    expect((await source.addConductFlag({ ...ex, text: 'oi' })).text).toBe('oi');
    http.expectNone(plan);
  });
});
