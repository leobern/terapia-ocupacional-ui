import { ProvisionalPlanSource } from './provisional-plan-source';

describe('ProvisionalPlanSource', () => {
  it('p1 começa com NE; paciente desconhecido sem via', async () => {
    const source = new ProvisionalPlanSource();

    expect((await source.loadRoute('p1'))?.routes).toEqual(['NE']);
    expect(await source.loadRoute('x')).toBeNull();
  });

  it('grava normalizado e a última gravação prevalece', async () => {
    const source = new ProvisionalPlanSource();

    await source.saveRoute({ at: '2026-11-20T10:00:00Z', author: 'A', patientId: 'x', routes: ['NE', 'VO'] });
    await source.saveRoute({ at: '2026-11-20T10:00:05Z', author: 'B', patientId: 'x', routes: ['NP'] });

    expect(await source.loadRoute('x')).toEqual({ routes: ['NP'], since: '2026-11-20T10:00:05Z' });
  });

  it('decisão de deglutição: começa vazia, grava e não mexe na via', async () => {
    const source = new ProvisionalPlanSource();

    expect(await source.loadSwallowing('p1')).toBeNull();
    await source.saveSwallowing({ at: 'x', author: 'A', decision: 'needed', patientId: 'p1' });

    expect(await source.loadSwallowing('p1')).toBe('needed');
    expect((await source.loadRoute('p1'))?.routes).toEqual(['NE']);
    await source.saveRoute({ at: '2026-11-21T10:00:00Z', author: 'A', patientId: 'p1', routes: ['VO'] });

    expect(await source.loadSwallowing('p1')).toBe('needed');
  });

  it('sinalizações: acumulam por paciente, não mexem na via e geram trilha de auditoria só de acréscimo', async () => {
    const source = new ProvisionalPlanSource();

    expect(await source.loadConductFlags('p1')).toEqual([]);
    await source.addConductFlag({ at: '2026-11-20T10:00:00Z', author: 'A', patientId: 'p1', text: 'Liberar VO' });
    await source.addConductFlag({ at: '2026-11-20T11:00:00Z', author: 'B', patientId: 'p1', text: 'Reavaliar' });

    expect((await source.loadConductFlags('p1')).map(f => f.text)).toEqual(['Liberar VO', 'Reavaliar']);
    expect(await source.loadConductFlags('x')).toEqual([]);
    expect((await source.loadRoute('p1'))?.routes).toEqual(['NE']);
    expect(source.auditTrail()).toEqual([
      { at: '2026-11-20T10:00:00Z', author: 'A', flagId: 'p1-1', patientId: 'p1' },
      { at: '2026-11-20T11:00:00Z', author: 'B', flagId: 'p1-2', patientId: 'p1' },
    ]);

    expect(Object.isFrozen(source.auditTrail()[0])).toBe(true);
  });

  it('pesos calculados, peso de referência e metas: leitura e última gravação', async () => {
    const source = new ProvisionalPlanSource();
    const weight = { kg: 68, kind: 'adjusted' } as const;
    const targets = {
      calorimetry: null,
      formula: 'simplified',
      kcalPerDay: 1700,
      kcalPerKg: 25,
      proteinPerDay: 102,
      proteinPerKg: 1.5,
      referenceWeight: weight,
    } as const;

    expect((await source.loadCalculatedWeights('p1')).adjusted).toBe(68);
    expect(await source.loadCalculatedWeights('x')).toEqual({});
    expect(await source.loadReferenceWeight('p1')).toBeNull();
    expect(await source.loadTargets('p1')).toBeNull();
    await source.saveReferenceWeight({ at: 'x', author: 'A', patientId: 'p1', weight });
    await source.saveTargets({ at: 'x', author: 'A', patientId: 'p1', targets });

    expect(await source.loadReferenceWeight('p1')).toEqual(weight);
    expect(await source.loadTargets('p1')).toEqual(targets);
  });
});
