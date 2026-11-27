import { environment } from '@environments/environment';

import {
  demoAssessment,
  demoClinicalAssessment,
  demoDiagnosis,
  demoEvolution,
  demoHypothesis,
  demoPrescriptions,
  demoRoute,
  demoSlot,
  demoTargets,
  demoWeights,
} from './demo-clinical-data';

describe('demo-clinical-data', () => {
  const env = environment as { devBackend?: boolean };
  const original = env.devBackend;
  const base = {
    device: '',
    heightCm: null,
    items: [{ id: 'nrs', ranges: [], title: 'NRS-2002', unit: 'pontos', value: '0' }],
    tnType: '',
    weightKg: null,
  };

  afterEach(() => {
    env.devBackend = original;
  });

  it('fora do modo local não gera nada, nem para id numérico', () => {
    env.devBackend = false;

    expect(demoSlot('1')).toBeNull();
    expect(demoDiagnosis('1')).toBeUndefined();
    expect(demoEvolution('1', '2026-11-24')).toBeUndefined();
  });

  it('só gera para id numérico e deixa sem dados os pacientes que não iniciaram a terapia', () => {
    env.devBackend = true;

    expect(demoSlot('p1')).toBeNull();
    expect(demoSlot('10')).toBeNull();
    expect(demoSlot('3')).toBe(3);
    expect(demoDiagnosis('11')).toBeUndefined();
  });

  it('gera o conjunto clínico de um paciente de demonstração', () => {
    env.devBackend = true;

    for (const id of ['1', '2', '3', '4', '5', '12', '13']) {
      expect(demoDiagnosis(id)?.protocols.length).toBe(2);
      expect(demoHypothesis(id)).toBeTruthy();
      expect(demoClinicalAssessment(id, base)?.items.length).toBe(1);
      expect(demoAssessment(id)?.values.weight).toBeTruthy();
      expect(demoPrescriptions(id)?.length).toBe(1);
      expect(demoRoute(id)?.routes.length).toBe(1);
      expect(demoTargets(id)?.kcalPerDay).toBeGreaterThan(0);
      expect(demoWeights(id)?.current).toBeGreaterThan(0);
    }
  });

  it('a evolução só existe entre a internação e hoje', () => {
    env.devBackend = true;
    const day = (ago: number): string => new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);

    expect(demoEvolution('7', day(1))?.text).toBeTruthy();
    expect(demoEvolution('7', day(30))).toBeUndefined();
    expect(demoEvolution('7', day(-3))).toBeUndefined();
    expect(demoEvolution('7', day(1))?.reevaluations).toBeDefined();
    expect(demoEvolution('7', day(5))?.reevaluations?.length).toBe(1);
  });

  it('sem os dados do paciente, as demais fábricas devolvem undefined', () => {
    env.devBackend = true;

    expect(demoHypothesis('18')).toBeUndefined();
    expect(demoClinicalAssessment('18', base)).toBeUndefined();
    expect(demoAssessment('18')).toBeUndefined();
    expect(demoPrescriptions('18')).toBeUndefined();
    expect(demoRoute('18')).toBeUndefined();
    expect(demoTargets('18')).toBeUndefined();
    expect(demoWeights('18')).toBeUndefined();
  });
});
