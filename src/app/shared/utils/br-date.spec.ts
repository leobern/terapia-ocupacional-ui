import {
  formatBirthDate,
  formatDateTimeShortYear,
  formatDayShortYear,
  formatShortYearDate,
  parseBrDate,
} from './br-date';

describe('br-date', () => {
  describe('parseBrDate', () => {
    for (const text of ['18/06/1945', '18-06-1945', '18.06.1945', '18 06 1945', '18061945', ' 18-06-1945 ']) {
      it(`aceita "${text}"`, () => {
        expect(parseBrDate(text)?.iso).toBe('1945-06-18');
      });
    }

    for (const text of ['8/6/1945', '8-6-1945', '8.6.1945', '8 6 1945', '08/6/1945', '8/06/1945']) {
      it(`aceita dia e mês com 1 dígito quando há separador: "${text}"`, () => {
        expect(parseBrDate(text)?.iso).toBe('1945-06-08');
      });
    }

    for (const text of [
      '',
      '18/06/45',
      '180645',
      '861945',
      '8061945',
      '180619450',
      '1945-06-18',
      '1945/06/18',
      '19450618',
      '06/18/1945',
      '31/02/2000',
      '31022000',
      '29-02-2025',
      '00/06/1945',
      '18/00/1945',
      '18/06/0045',
      '18/06-1945',
      '18//06/1945',
      '18 de junho de 1945',
    ]) {
      it(`recusa "${text}"`, () => {
        expect(parseBrDate(text)).toBeNull();
      });
    }

    it('aceita 29 de fevereiro em ano bissexto', () => {
      expect(parseBrDate('29.02.2024')?.iso).toBe('2024-02-29');
    });
  });

  describe('exibição', () => {
    it('data de nascimento com o ano completo', () => {
      expect(formatBirthDate('1945-06-18')).toBe('18/06/1945');
    });

    it('demais datas com o ano em 2 dígitos', () => {
      expect(formatShortYearDate('1945-06-18')).toBe('18/06/45');
      expect(formatDayShortYear(new Date(2026, 0, 5))).toBe('05/01/26');
      expect(formatDayShortYear(new Date(2005, 11, 31))).toBe('31/12/05');
    });

    it('data e hora no fuso local', () => {
      expect(formatDateTimeShortYear(new Date(2026, 10, 3, 9, 5).toISOString())).toBe('03/11/26 09:05');
    });
  });
});
