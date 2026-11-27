/** Leitura e exibição de datas no padrão dia, mês, ano. O que vai para a API segue `aaaa-mm-dd`. */

/** Dia e mês com 1 ou 2 dígitos, o mesmo separador (barra, traço, ponto ou espaço) e ano com 4. */
const SEPARATED = /^(\d{1,2})([/. -])(\d{1,2})\2(\d{4})$/u;
/** Sem separador, só os 8 dígitos `ddmmaaaa` (com menos, dia e mês ficam ambíguos). */
const COMPACT = /^(\d{2})(\d{2})(\d{4})$/u;

export interface BrDate {
  readonly date: Date;
  /** `aaaa-mm-dd`. */
  readonly iso: string;
}

function split(text: string): readonly [string, string, string] | null {
  const separated = SEPARATED.exec(text);

  if (separated) {
    return [separated[1], separated[3], separated[4]];
  }
  const compact = COMPACT.exec(text);

  return compact ? [compact[1], compact[2], compact[3]] : null;
}

/** Data digitada em dia-mês-ano e existente; `null` se o formato não é aceito ou a data não existe. */
export function parseBrDate(raw: string): BrDate | null {
  const parts = split(raw.trim());

  if (!parts) {
    return null;
  }
  const [day, month, year] = parts.map(Number);
  const date = new Date(year, month - 1, day);

  // `new Date` trata os anos 0-99 como 19xx: a conferência do ano também os recusa.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return { date, iso: `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` };
}

const two = (value: number): string => String(value).padStart(2, '0');

/** Data de nascimento: `aaaa-mm-dd` vira `dd/mm/aaaa` (a única exibida com o ano completo). */
export function formatBirthDate(iso: string): string {
  const [year, month, day] = iso.split('-');

  return `${day}/${month}/${year}`;
}

/** Demais datas de calendário (sem fuso): `aaaa-mm-dd` vira `dd/mm/aa`. */
export function formatShortYearDate(iso: string): string {
  const [year, month, day] = iso.split('-');

  return `${day}/${month}/${year.slice(-2)}`;
}

/** Data de um `Date` no fuso local, em `dd/mm/aa`. */
export function formatDayShortYear(date: Date): string {
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${two(date.getFullYear() % 100)}`;
}

/** Instante ISO no fuso local, em `dd/mm/aa HH:mm`. */
export function formatDateTimeShortYear(iso: string): string {
  const date = new Date(iso);

  return `${formatDayShortYear(date)} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
