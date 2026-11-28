import { parseBrDate } from '../../shared/utils/br-date';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;

/** Converte dia-mês-ano (ver `parseBrDate`) ou `yyyy-MM-dd` para ISO; `null` se não for data real ou se for futura. */
export function parseBirthDate(text: string, today: Date = new Date()): string | null {
  const raw = text.trim();
  const iso = ISO_DATE.exec(raw);
  // O ISO é reordenado para dia-mês-ano e passa pela mesma conferência de data existente.
  const parsed = parseBrDate(iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : raw);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return parsed && parsed.date <= startOfToday ? parsed.iso : null;
}
