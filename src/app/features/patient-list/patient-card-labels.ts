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
