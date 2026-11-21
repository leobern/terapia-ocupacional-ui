import { formatNumber } from '../plan/plan-targets';

/** Prescrição ativa do paciente (FT-004-8). Somente leitura nesta story: manter não altera nenhum campo. */
export interface ActivePrescription {
  /** ISO de quando foi prescrita. */
  readonly at: string;
  readonly author: string;
  /** Nome da fórmula do catálogo da Farmácia. */
  readonly formula: string;
  /** Horas de administração por dia; `null` quando não informado. */
  readonly hoursPerDay: number | null;
  readonly kcal: number;
  /** Vazão em ml/h; `null` quando não se aplica. */
  readonly flowMlPerHour: number | null;
  readonly proteinG: number;
  /** Módulo proteico em g; `null` quando não há. */
  readonly proteinModuleG: number | null;
  readonly role: string;
  readonly volumeMlPerDay: number;
}

/** Registro de que a revisão diária ocorreu (decisão "manter"). */
export interface PrescriptionReview {
  readonly at: string;
  readonly author: string;
  /** Dia da revisão (AAAA-MM-DD). */
  readonly day: string;
}

export interface PrescriptionReviewRequest extends PrescriptionReview {
  readonly patientId: string;
}

/** Texto de um número opcional com unidade; "—" quando ausente. */
export function formatOptional(value: number | null, unit: string, digits = 0): string {
  return value === null ? '—' : `${formatNumber(value, 0, digits)} ${unit}`;
}
