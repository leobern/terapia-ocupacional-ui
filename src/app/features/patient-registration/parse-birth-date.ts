const BR_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Converte `dd/MM/yyyy` ou `yyyy-MM-dd` para ISO; `null` se não for data real ou se for futura. */
export function parseBirthDate(text: string, today: Date = new Date()): string | null {
  const raw = text.trim();
  const br = BR_DATE.exec(raw);
  const iso = ISO_DATE.exec(raw);
  let parts: (string | undefined)[] = [];

  if (br) {
    parts = [br[3], br[2], br[1]];
  } else if (iso) {
    parts = [iso[1], iso[2], iso[3]];
  }
  const [year, month, day] = parts;

  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const real =
    date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return real && date <= startOfToday ? `${year}-${month}-${day}` : null;
}

/** `yyyy-MM-dd` → `dd/MM/yyyy`. */
export function formatBirthDate(iso: string): string {
  const [year, month, day] = iso.split('-');

  return `${day}/${month}/${year}`;
}
