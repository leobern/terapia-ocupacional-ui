import {
  dayKey,
  formatEntryTime,
  formatParameterValue,
  isSameDay,
  parseParameterValue,
  registeredAt,
} from './daily-record.models';

describe('daily-record.models', () => {
  it('dayKey formata AAAA-MM-DD com zeros à esquerda', () => {
    expect(dayKey(new Date(2026, 0, 5, 10))).toBe('2026-01-05');
  });

  it('registeredAt formata dd/MM às HH:mm', () => {
    expect(registeredAt(new Date(2026, 4, 8, 9, 5).toISOString())).toBe('08/05 às 09:05');
  });

  it('parseParameterValue aceita número com ponto ou vírgula e rejeita o resto', () => {
    expect(parseParameterValue(' 132 ')).toBe(132);
    expect(parseParameterValue('4,2')).toBe(4.2);
    expect(parseParameterValue('0')).toBe(0);
    for (const bad of ['', 'abc', '-1', '1,2,3', '12 mg']) {
      expect(parseParameterValue(bad)).toBeNull();
    }
  });

  it('formata valor em pt-BR e hora local HH:mm', () => {
    expect(formatParameterValue(4.2)).toBe('4,2');
    expect(formatEntryTime(new Date(2026, 4, 28, 8, 5).toISOString())).toBe('08:05');
  });

  it('isSameDay compara o dia civil local', () => {
    const ref = new Date(2026, 4, 28, 12);

    expect(isSameDay(new Date(2026, 4, 28, 1).toISOString(), ref)).toBeTrue();
    expect(isSameDay(new Date(2026, 4, 27, 23).toISOString(), ref)).toBeFalse();
  });
});
