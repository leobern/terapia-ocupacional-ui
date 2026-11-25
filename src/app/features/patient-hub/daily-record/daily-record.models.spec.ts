import {
  dayKey,
  formatEntryTime,
  formatParameterValue,
  isSameDay,
  parseParameterValue,
  reevaluationDueAt,
  reevaluationStatus,
  registeredAt,
  shortDate,
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

  it('reevaluationDueAt soma horas ou dias ao momento da evolução', () => {
    const from = new Date(2026, 4, 26, 10, 0);

    expect(new Date(reevaluationDueAt(from, 48, 'hours')).getTime()).toBe(new Date(2026, 4, 28, 10, 0).getTime());
    expect(new Date(reevaluationDueAt(from, 3, 'days')).getTime()).toBe(new Date(2026, 4, 29, 10, 0).getTime());
  });

  it('shortDate formata dd/MM e reevaluationStatus separa vencida de dentro do prazo (sempre com texto)', () => {
    const due = new Date(2026, 4, 30, 9, 0).toISOString();

    expect(shortDate(due)).toBe('30/05');
    expect(reevaluationStatus(due, new Date(2026, 4, 29))).toEqual({ kind: 'upcoming', label: 'Prazo 30/05' });
    expect(reevaluationStatus(due, new Date(2026, 4, 31))).toEqual({ kind: 'overdue', label: 'Vencida' });
  });
});
