import type { MeasurePoint } from '../charts/measure-chart.component';

/** Dias atrás de cada medição da série provisória, da mais antiga à de hoje. */
const DAYS_AGO: readonly number[] = [20, 15, 10, 6, 3, 0];

/** Número de um valor de item ("4", "4,2", "183–257" → média da faixa); `null` quando não há número. */
export function numericValue(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }
  const parts = value
    .split(/[–-]/)
    .map(part => Number(part.trim().replace(',', '.')))
    .filter(n => Number.isFinite(n));

  if (parts.length === 0) {
    return null;
  }

  return parts.reduce((sum, n) => sum + n, 0) / parts.length;
}

function hash(text: string): number {
  let h = 17;

  for (const char of text) {
    h = (h * 31 + char.charCodeAt(0)) % 100_003;
  }

  return h;
}

const dayLabel = (daysAgo: number, today: Date): string => {
  const d = new Date(today.getTime() - daysAgo * 86_400_000);

  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Série de progressão PROVISÓRIA de um item da avaliação clínica (NRS, GLIM, SARC-F...): até existir o histórico real,
 * 6 medições determinísticas por paciente e item que terminam no valor atual. Sem número, não há série.
 */
export function clinicalItemTrend(
  patientId: string,
  itemId: string,
  value: string,
  today: Date = new Date(),
): readonly MeasurePoint[] {
  const current = numericValue(value);

  if (current === null) {
    return [];
  }
  const seed = hash(`${patientId}:${itemId}`);
  const whole = Number.isInteger(current);
  const amplitude = Math.max(Math.abs(current) * 0.3, whole ? 2 : 1);
  const direction = seed % 2 === 0 ? 1 : -1;

  return DAYS_AGO.map((daysAgo, index) => {
    const remaining = DAYS_AGO.length - 1 - index;
    const noise = (((seed >> index) % 5) - 2) / 10;
    const raw = remaining === 0 ? current : current + direction * (amplitude / 5) * remaining * (1 + noise);
    const rounded = Math.max(0, whole ? Math.round(raw) : Math.round(raw * 10) / 10);

    return { label: dayLabel(daysAgo, today), value: rounded };
  });
}
