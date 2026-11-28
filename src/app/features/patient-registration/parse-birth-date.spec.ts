import { parseBirthDate } from './parse-birth-date';

describe('parseBirthDate', () => {
  const today = new Date(2026, 10, 24);

  it('converts dd/MM/yyyy and ISO to ISO', () => {
    expect(parseBirthDate('14/03/1985', today)).toBe('1985-03-14');
    expect(parseBirthDate(' 1985-03-14 ', today)).toBe('1985-03-14');
  });

  it('accepts today and rejects tomorrow', () => {
    expect(parseBirthDate('24/11/2026', today)).toBe('2026-11-24');
    expect(parseBirthDate('25/11/2026', today)).toBeNull();
  });

  it('rejects impossible and malformed dates', () => {
    expect(parseBirthDate('31/02/2000', today)).toBeNull();
    expect(parseBirthDate('abc', today)).toBeNull();
    expect(parseBirthDate('', today)).toBeNull();
  });

  it('uses the current day by default', () => {
    expect(parseBirthDate('01/01/2999')).toBeNull();
    expect(parseBirthDate('01/01/2000')).toBe('2000-01-01');
  });

  it('aceita traço, ponto, espaço, só dígitos e ISO', () => {
    for (const text of ['18-06-1945', '18.06.1945', '18 06 1945', '18061945', '18/6/1945', '1945-06-18']) {
      expect(parseBirthDate(text, today)).withContext(text).toBe('1945-06-18');
    }
  });

  it('recusa ano de 2 dígitos e data ISO inexistente', () => {
    expect(parseBirthDate('18/06/45', today)).toBeNull();
    expect(parseBirthDate('2000-02-31', today)).toBeNull();
  });
});
