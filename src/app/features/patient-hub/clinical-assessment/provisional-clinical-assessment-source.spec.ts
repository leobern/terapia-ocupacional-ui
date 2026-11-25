import { ProvisionalClinicalAssessmentSource } from './provisional-clinical-assessment-source';

describe('ProvisionalClinicalAssessmentSource', () => {
  const key = 'conductia:clinical-assessment:v2:p-spec';

  afterEach(() => localStorage.removeItem(key));

  it('paciente novo (sem registro) começa vazio; só o p1 tem o exemplo', async () => {
    const source = new ProvisionalClinicalAssessmentSource();
    const empty = await source.load('p-spec');

    expect(empty).toEqual({ device: '', heightCm: null, items: [], tnType: '', weightKg: null });
    expect((await source.load('p1')).tnType).toBe('NE');
  });

  it('depois de salvar devolve o que foi gravado', async () => {
    const source = new ProvisionalClinicalAssessmentSource();
    const seed = await source.load('p1');

    expect(seed.tnType).toBe('NE');
    expect(seed.items.length).toBeGreaterThan(0);

    await source.save('p-spec', { ...seed, items: [], weightKg: 60 });
    const saved = await source.load('p-spec');

    expect(saved.items).toEqual([]);
    expect(saved.weightKg).toBe(60);
  });
});
