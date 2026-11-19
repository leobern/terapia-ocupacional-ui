import { formatRelativeTime } from './relative-time';

describe('formatRelativeTime', () => {
  const now = new Date(2026, 10, 18, 15, 0);

  it('mostra "Hoje, HH:mm" para o mesmo dia', () => {
    expect(formatRelativeTime(new Date(2026, 10, 18, 10, 42).toISOString(), now)).toBe('Hoje, 10:42');
  });

  it('mostra "Ontem, HH:mm" para o dia anterior', () => {
    expect(formatRelativeTime(new Date(2026, 10, 17, 19, 27).toISOString(), now)).toBe('Ontem, 19:27');
  });

  it('mostra "dd/MM, HH:mm" para datas mais antigas', () => {
    expect(formatRelativeTime(new Date(2026, 10, 10, 8, 3).toISOString(), now)).toBe('10/11, 08:03');
  });
});
