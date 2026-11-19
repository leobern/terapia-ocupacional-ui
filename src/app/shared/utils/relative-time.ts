/**
 * Horário relativo dos cards (Figma "Conductia - V1": "Hoje, 10:42", "Ontem, 19:27").
 * Mais antigo que ontem: "17/11, 10:42".
 */
export function formatRelativeTime(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate);
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
  const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days === 0) {
    return `Hoje, ${time}`;
  }
  if (days === 1) {
    return `Ontem, ${time}`;
  }

  return `${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)}, ${time}`;
}
