import { clinicalItemTrend, numericValue } from './clinical-item-trend';

describe('clinical-item-trend', () => {
  const today = new Date('2026-11-25T12:00:00');

  it('extrai o número do valor, com vírgula decimal e média de faixa; sem número, null', () => {
    expect(numericValue('4')).toBe(4);
    expect(numericValue('4,2')).toBe(4.2);
    expect(numericValue('183–257')).toBe(220);
    expect(numericValue('')).toBeNull();
    expect(numericValue('abc')).toBeNull();
  });

  it('gera 6 medições que terminam no valor atual, sem valores negativos', () => {
    const series = clinicalItemTrend('7', 'nrs', '4', today);

    expect(series.length).toBe(6);
    expect(series.at(-1)).toEqual({ label: '25/11', value: 4 });
    expect(series[0].label).toBe('05/11');
    expect(series.every(p => p.value >= 0)).toBeTrue();
  });

  it('é determinística e mantém uma casa decimal para valores fracionários', () => {
    const a = clinicalItemTrend('7', 'angulo-fase', '4,2', today);

    expect(clinicalItemTrend('7', 'angulo-fase', '4,2', today)).toEqual(a);
    expect(a.at(-1)?.value).toBe(4.2);
  });

  it('sem número não há série', () => {
    expect(clinicalItemTrend('7', 'nrs', '', today)).toEqual([]);
  });
});
