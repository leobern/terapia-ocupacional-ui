/** Dia da semana como em `Date#getDay()`: 0 = domingo … 6 = sábado. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Dias da semana na ordem de exibição (segunda a domingo). */
export const WEEKDAYS: readonly { readonly id: Weekday; readonly label: string; readonly full: string }[] = [
  { full: 'Segunda-feira', id: 1, label: 'Seg' },
  { full: 'Terça-feira', id: 2, label: 'Ter' },
  { full: 'Quarta-feira', id: 3, label: 'Qua' },
  { full: 'Quinta-feira', id: 4, label: 'Qui' },
  { full: 'Sexta-feira', id: 5, label: 'Sex' },
  { full: 'Sábado', id: 6, label: 'Sáb' },
  { full: 'Domingo', id: 0, label: 'Dom' },
];

/** Cadência da próxima revisão (FT-004-6, FR-012/013): os dias da semana em que o paciente deve ser reavaliado. */
export type ReviewCadence = readonly Weekday[];

/** "Diária" equivale a todos os dias da semana e é o valor quando o paciente não tem cadência gravada. */
export const DAILY_CADENCE: ReviewCadence = WEEKDAYS.map(d => d.id);

export interface CadenceSaveRequest {
  readonly at: string;
  readonly author: string;
  readonly days: ReviewCadence;
  readonly patientId: string;
}

/** Remove duplicatas e ordena de segunda a domingo. */
export function normalizeCadence(days: readonly Weekday[]): Weekday[] {
  return WEEKDAYS.map(d => d.id).filter(id => days.includes(id));
}

export function isDailyCadence(days: readonly Weekday[]): boolean {
  return normalizeCadence(days).length === DAILY_CADENCE.length;
}

/** Texto da cadência: "Diária" ou "Seg, qua e sex". */
export function cadenceLabel(days: readonly Weekday[]): string {
  if (isDailyCadence(days)) {
    return 'Diária';
  }
  const names = WEEKDAYS.filter(d => days.includes(d.id)).map(d => d.label.toLowerCase());

  if (names.length === 0) {
    return 'Nenhum dia marcado';
  }
  const text = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** O dia (no fuso local) está previsto pela cadência? Sem cadência gravada vale a diária (FR-012/FR-014). */
export function isReviewDay(cadence: ReviewCadence | undefined, day: Date): boolean {
  return (cadence ?? DAILY_CADENCE).includes(day.getDay() as Weekday);
}
