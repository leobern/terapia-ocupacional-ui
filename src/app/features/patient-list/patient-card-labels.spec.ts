import { adequacyLabel, hasAdequacy, therapyStartLabel } from './patient-card-labels';

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
});
