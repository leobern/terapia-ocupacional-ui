import { adequacyLabel, dailyAdequacy, goalLabel, hasAdequacy, therapyStartLabel } from './patient-card-labels';

describe('patient-card-labels', () => {
  it('formata o início da terapia', () => {
    expect(therapyStartLabel(0)).toBe('TN iniciada hoje');
    expect(therapyStartLabel(1)).toBe('TN há 1 dia');
    expect(therapyStartLabel(9)).toBe('TN há 9 dias');
    expect(therapyStartLabel(30)).toBe('TN há 1 mês');
    expect(therapyStartLabel(75)).toBe('TN há 2 meses');
  });

  it('adequação: indisponível, parcial e completa', () => {
    expect(adequacyLabel(null)).toBe('Adequação indisponível');
    expect(adequacyLabel({ caloric: null, protein: null })).toBe('Adequação indisponível');
    expect(adequacyLabel({ caloric: 15, protein: null })).toBe('Calórica 15% · Proteica indisponível');
    expect(adequacyLabel({ caloric: null, protein: 60 })).toBe('Calórica indisponível · Proteica 60%');
    expect(adequacyLabel({ caloric: 0, protein: 80 })).toBe('Calórica 0% · Proteica 80%');
    expect(hasAdequacy(null)).toBe(false);
    expect(hasAdequacy({ caloric: null, protein: 1 })).toBe(true);
    expect(hasAdequacy({ caloric: null, protein: null })).toBe(false);
  });

  it('agrega a adequação do dia só com os valores presentes', () => {
    expect(dailyAdequacy([])).toBeNull();
    expect(dailyAdequacy([{ adequacy: null }])).toBeNull();
    expect(
      dailyAdequacy([
        { adequacy: { caloric: 80, protein: null } },
        { adequacy: { caloric: 41, protein: 60 } },
        { adequacy: null },
      ]),
    ).toEqual({ caloric: 61, protein: 60 });
  });

  it('meta com texto de situação', () => {
    expect(goalLabel(null)).toBe('Indisponível');
    expect(goalLabel(10)).toBe('10% · crítico');
    expect(goalLabel(30)).toBe('30% · alerta');
    expect(goalLabel(50)).toBe('50% · na meta');
  });
});
