import { cadenceLabel, DAILY_CADENCE, isDailyCadence, isReviewDay, normalizeCadence, Weekday } from './review-cadence';

describe('review-cadence', () => {
  it('diária cobre os sete dias e é o padrão sem cadência gravada', () => {
    expect(DAILY_CADENCE.length).toBe(7);
    expect(isDailyCadence([0, 1, 2, 3, 4, 5, 6])).toBe(true);
    expect(isDailyCadence([1, 3])).toBe(false);
  });

  it('normaliza ordem (seg a dom) e duplicatas', () => {
    expect(normalizeCadence([0, 5, 1, 5])).toEqual([1, 5, 0]);
  });

  it('descreve a cadência em texto', () => {
    expect(cadenceLabel(DAILY_CADENCE)).toBe('Diária');
    expect(cadenceLabel([5, 1, 3])).toBe('Seg, qua e sex');
    expect(cadenceLabel([2])).toBe('Ter');
    expect(cadenceLabel([])).toBe('Nenhum dia marcado');
  });

  it('isReviewDay: todos os dias da semana com diária/ausente; só os marcados com dias específicos', () => {
    // 2026-11-16 é segunda-feira.
    for (let i = 0; i < 7; i++) {
      const day = new Date(2026, 10, 16 + i);

      expect(isReviewDay(undefined, day)).toBe(true);
      expect(isReviewDay(DAILY_CADENCE, day)).toBe(true);
      expect(isReviewDay([1, 3], day)).toBe(([1, 3] as Weekday[]).includes(day.getDay() as Weekday));
    }
  });
});
