import { dayKey, registeredAt } from './daily-record.models';

describe('daily-record.models', () => {
  it('dayKey formata AAAA-MM-DD com zeros à esquerda', () => {
    expect(dayKey(new Date(2026, 0, 5, 10))).toBe('2026-01-05');
  });

  it('registeredAt formata dd/MM às HH:mm', () => {
    expect(registeredAt(new Date(2026, 4, 8, 9, 5).toISOString())).toBe('08/05 às 09:05');
  });
});
