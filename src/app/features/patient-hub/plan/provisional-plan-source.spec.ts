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

  it('cadência: começa vazia (vale a diária), grava normalizada e não mexe na via', async () => {
    const source = new ProvisionalPlanSource();

    expect(await source.loadCadence('p1')).toBeNull();
    await source.saveCadence({ at: 'x', author: 'A', days: [5, 1], patientId: 'p1' });

    expect(await source.loadCadence('p1')).toEqual([1, 5]);
    expect((await source.loadRoute('p1'))?.routes).toEqual(['NE']);
  });

  it('responsável: começa vazio, grava e lista médicos', async () => {
    const source = new ProvisionalPlanSource();

    expect(await source.loadResponsible('p1')).toBeNull();
    await source.saveResponsible({ at: 'x', author: 'A', name: 'Dra. Ana', patientId: 'p1' });

    expect(await source.loadResponsible('p1')).toBe('Dra. Ana');
    expect(await source.loadResponsibleOptions()).toContain('Dra. Ana');
  });
});
