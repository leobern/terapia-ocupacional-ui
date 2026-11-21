import {
  CLOSURE_REASONS,
  formatIsoDate,
  FUTURE_DATE_HINT,
  INVALID_DATE_HINT,
  reasonLabel,
  toIsoDate,
  validateEffectiveDate,
} from './follow-up-closure.models';

describe('follow-up-closure.models', () => {
  const today = new Date(2026, 10, 21, 15, 0);

  it('oferece os 4 motivos da spec, com o texto de apoio da alta da EMTN', () => {
    expect(CLOSURE_REASONS.map(r => r.label)).toEqual([
      'Alta hospitalar',
      'Óbito',
      'Alta da EMTN',
      'Transferência externa',
    ]);

    expect(CLOSURE_REASONS.find(r => r.id === 'emtn-discharge')?.help).toContain('Segue internado');
  });

  it('rotula o motivo e cai no id quando desconhecido', () => {
    expect(reasonLabel('death')).toBe('Óbito');
    expect(reasonLabel('x' as never)).toBe('x');
  });

  it('formata datas no fuso local', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(formatIsoDate('2026-11-20')).toBe('20/11/2026');
  });

  it('aceita hoje e datas passadas, recusa futura e inválida', () => {
    expect(validateEffectiveDate('2026-11-21', today)).toBeNull();
    expect(validateEffectiveDate('2026-01-01', today)).toBeNull();
    expect(validateEffectiveDate('2026-11-22', today)).toBe(FUTURE_DATE_HINT);
    expect(validateEffectiveDate('', today)).toBe(INVALID_DATE_HINT);
    expect(validateEffectiveDate('2026-13-45', today)).toBe(INVALID_DATE_HINT);
  });
});
