import { computeTargets, formatNumber, formatWeight, parsePositive, referenceWeightLabel } from './plan-targets';

describe('plan-targets', () => {
  it('aceita vírgula ou ponto e recusa vazio, zero, negativo e texto', () => {
    expect(parsePositive('1,5')).toBe(1.5);
    expect(parsePositive(' 25 ')).toBe(25);
    for (const bad of ['', '0', '-1', 'abc', '1,2,3']) {
      expect(parsePositive(bad)).toBeNull();
    }
  });

  it('fórmula simplificada: 75 kg × 25 e × 1,5', () => {
    const t = computeTargets({
      calorimetry: null,
      kcalPerKg: 25,
      proteinPerKg: 1.5,
      referenceWeight: { kg: 75, kind: 'current' },
    });

    expect([t.formula, t.kcalPerDay, t.proteinPerDay]).toEqual(['simplified', 1875, 112.5]);
  });

  it('calorimetria: 70% de 1.450 = 1.015 e kcal/kg derivado', () => {
    const t = computeTargets({
      calorimetry: { kcal: 1450, percent: 70 },
      kcalPerKg: 25,
      proteinPerKg: 1.5,
      referenceWeight: { kg: 70, kind: 'ideal' },
    });

    expect([t.formula, t.kcalPerDay, t.kcalPerKg]).toEqual(['indirect-calorimetry', 1015, 14.5]);
  });

  it('formata em pt-BR', () => {
    expect(formatNumber(1875)).toBe('1.875');
    expect(formatWeight(68)).toBe('68,0 kg');
    expect(referenceWeightLabel({ kg: 68, kind: 'adjusted' })).toBe('Ajustado · 68,0 kg');
  });
});
