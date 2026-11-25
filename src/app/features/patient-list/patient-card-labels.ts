import { Adequacy } from './patient-list.models';

/** Início da terapia nutricional em texto: tempo decorrido até a data selecionada (FR-003). */
export function therapyStartLabel(days: number): string {
  if (days === 0) {
    return 'TN iniciada hoje';
  }
  if (days < 30) {
    return `TN há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  }
  const months = Math.floor(days / 30);

  return `TN há ${months} ${months === 1 ? 'mês' : 'meses'}`;
}

/** Texto da adequação (cor nunca é o único sinal): indisponível nunca vira 0%. */
export function adequacyLabel(adequacy: Adequacy | null): string {
  if (adequacy === null || (adequacy.caloric === null && adequacy.protein === null)) {
    return 'Adequação indisponível';
  }
  const part = (name: string, v: number | null): string => (v === null ? `${name} indisponível` : `${name} ${v}%`);

  return `${part('Calórica', adequacy.caloric)} · ${part('Proteica', adequacy.protein)}`;
}

/** Há ao menos um valor para o gauge. */
export function hasAdequacy(adequacy: Adequacy | null): adequacy is Adequacy {
  return adequacy !== null && (adequacy.caloric !== null || adequacy.protein !== null);
}

/**
 * Média do dia das adequações já presentes na lista (FR-006): só agrega os valores recebidos,
 * sem recalcular a adequação individual. `null` quando ninguém tem o valor.
 */
export function dailyAdequacy(list: readonly { readonly adequacy: Adequacy | null }[]): Adequacy | null {
  const mean = (values: readonly number[]): number | null =>
    values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const pick = (key: keyof Adequacy): number[] =>
    list.flatMap(p => (p.adequacy?.[key] === null || p.adequacy === null ? [] : [p.adequacy[key] as number]));
  const result = { caloric: mean(pick('caloric')), protein: mean(pick('protein')) };

  return hasAdequacy(result) ? result : null;
}

/** Meta em % com texto de situação (a cor nunca é o único sinal): crítico <20, alerta <50, na meta. */
export function goalLabel(value: number | null): string {
  if (value === null) {
    return 'Indisponível';
  }
  let status = 'na meta';

  if (value < 20) {
    status = 'crítico';
  } else if (value < 50) {
    status = 'alerta';
  }

  return `${value}% · ${status}`;
}

/** Data de nascimento em texto (dd/mm/aaaa). */
export function birthLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');

  return `${day}/${month}/${year}`;
}

/** Tag de status da linha da tabela (fora a terapia): Finalizado e Primeira avaliação. Linha normal não tem tag. */
export interface StatusTag {
  readonly label: string;
  readonly tone: 'active' | 'neutral';
}

export function statusTags(patient: {
  readonly finished: boolean;
  readonly firstEvaluation: boolean;
}): readonly StatusTag[] {
  return [
    ...(patient.finished ? [{ label: 'Finalizado', tone: 'neutral' as const }] : []),
    ...(patient.firstEvaluation ? [{ label: 'Primeira avaliação', tone: 'active' as const }] : []),
  ];
}
