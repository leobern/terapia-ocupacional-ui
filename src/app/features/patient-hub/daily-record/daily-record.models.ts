/** Origem do texto gravado: alimenta a trilha de auditoria feita no backend (Princípio V). */
export type EvolutionOrigin = 'ai' | 'ai-edited' | 'manual';

/** Evolução médica vigente do dia (FT-004-7, US-004-7-04): texto, autor e data/hora do registro. */
export interface DailyEvolution {
  readonly author: string;
  /** ISO 8601 */
  readonly at: string;
  readonly origin: EvolutionOrigin;
  readonly text: string;
}

export interface EvolutionSaveRequest {
  readonly author: string;
  readonly at: string;
  readonly origin: EvolutionOrigin;
  readonly patientId: string;
  /** AAAA-MM-DD: dia a que a evolução pertence. */
  readonly day: string;
  readonly text: string;
}

/** AAAA-MM-DD no fuso local. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/** "28/05 às 16:05" a partir de um ISO. */
export function registeredAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');

  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
