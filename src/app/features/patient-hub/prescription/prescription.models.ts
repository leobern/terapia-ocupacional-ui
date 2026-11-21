export type AdministrationModality = 'continuous' | 'intermittent' | 'cyclic';

export const MODALITY_OPTIONS: readonly { readonly id: AdministrationModality; readonly label: string }[] = [
  { id: 'continuous', label: 'Contínua' },
  { id: 'intermittent', label: 'Intermitente' },
  { id: 'cyclic', label: 'Cíclica' },
];

/** Horas de administração da modalidade contínua, salvo informação em contrário (FR-006). */
export const CONTINUOUS_HOURS = 24;

/** Fórmula escolhida do catálogo da Farmácia (somente leitura aqui, FR-015). */
export interface PrescriptionFormula {
  readonly id: string;
  readonly name: string;
  readonly kcalPerMl: number | null;
  readonly proteinPerMl: number | null;
}

/** Entrada do formulário de ajuste; horários em `HH:MM`. */
export interface PrescriptionDraft {
  readonly formula: PrescriptionFormula | null;
  /** Texto digitado (vírgula ou ponto). */
  readonly volume: string;
  readonly modality: AdministrationModality;
  readonly startTime: string;
  readonly pauseTimes: readonly string[];
  readonly nursingNotes: string;
}

/** Prescrição vigente do paciente (uma por paciente nesta story). */
export interface Prescription {
  readonly formulaId: string;
  readonly formulaName: string;
  readonly kcalPerMl: number;
  readonly proteinPerMl: number;
  readonly volumeMl: number;
  readonly modality: AdministrationModality;
  readonly startTime: string;
  readonly pauseTimes: readonly string[];
  readonly nursingNotes: string;
  /** ISO 8601 */
  readonly at: string;
  readonly author: string;
}

export interface PrescriptionSaveRequest {
  readonly patientId: string;
  readonly prescription: Prescription;
}

/** Metas vigentes usadas na comparação; `null` = sem meta definida. */
export interface IntakeTargets {
  readonly kcalPerDay: number;
  readonly proteinPerDay: number;
}

export interface PrescriptionIntake {
  readonly kcal: number;
  readonly protein: number;
  /** Horas efetivamente administradas (24 na contínua). */
  readonly hours: number;
  readonly rateMlPerHour: number;
  /** Percentuais frente à meta; `null` quando não há meta. */
  readonly kcalPercent: number | null;
  readonly proteinPercent: number | null;
}

export interface PrescriptionEvaluation {
  /** `null` quando faltam dados para um aporte confiável (nunca um valor enganoso). */
  readonly intake: PrescriptionIntake | null;
  readonly errors: PrescriptionErrors;
  /** Pode ser salva: sem nenhum erro. */
  readonly valid: boolean;
}

export interface PrescriptionErrors {
  readonly formula?: string;
  readonly volume?: string;
  readonly startTime?: string;
  readonly pauseTimes?: string;
}

export const FORMULA_REQUIRED_HINT = 'Escolha uma fórmula do catálogo.';
export const FORMULA_NO_DENSITY_HINT = 'A fórmula escolhida não tem densidade calórica e proteica cadastrada.';
export const VOLUME_INVALID_HINT = 'Informe um volume maior que zero.';
export const START_REQUIRED_HINT = 'Informe o horário previsto de início.';
export const PAUSE_REQUIRED_HINT = 'Informe ao menos um horário de pausa para esta modalidade.';
export const PAUSE_BEFORE_START_HINT = 'A pausa deve ser depois do horário de início.';
export const PAUSE_DUPLICATED_HINT = 'Há horários de pausa repetidos.';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/u;

/** Minutos desde 00:00; `null` quando o texto não é um horário `HH:MM` válido. */
export function minutesOf(time: string): number | null {
  const match = TIME.exec(time.trim());

  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function parseVolume(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  const value = /^\d+(\.\d+)?$/u.test(normalized) ? Number(normalized) : Number.NaN;

  return Number.isFinite(value) && value > 0 ? value : null;
}

const round = (value: number, digits: number): number => Math.round(value * 10 ** digits) / 10 ** digits;

const hasDensity = (value: number | null): value is number => value !== null && value > 0;

/** Valida os horários e devolve as horas administradas (`null` se inválidas) e o erro. */
function scheduleOf(draft: PrescriptionDraft): { hours: number | null; errors: PrescriptionErrors } {
  const start = minutesOf(draft.startTime);

  if (start === null) {
    return { errors: { startTime: START_REQUIRED_HINT }, hours: null };
  }
  if (draft.modality === 'continuous') {
    return { errors: {}, hours: CONTINUOUS_HOURS };
  }
  const pauses = draft.pauseTimes.map(minutesOf);

  if (pauses.length === 0 || pauses.includes(null)) {
    return { errors: { pauseTimes: PAUSE_REQUIRED_HINT }, hours: null };
  }
  const valid = pauses as number[];

  if (new Set(valid).size !== valid.length) {
    return { errors: { pauseTimes: PAUSE_DUPLICATED_HINT }, hours: null };
  }
  if (valid.some(p => p <= start)) {
    return { errors: { pauseTimes: PAUSE_BEFORE_START_HINT }, hours: null };
  }

  // Administra do início até a última pausa do dia (decisão: as pausas intermediárias não somam horas).
  return { errors: {}, hours: (Math.max(...valid) - start) / 60 };
}

/**
 * Aporte da prescrição: taxa = volume ÷ horas; kcal e proteína = taxa × horas × densidade por ml.
 * Compara com a meta vigente quando existe (FR-005..FR-007).
 */
export function evaluatePrescription(draft: PrescriptionDraft, targets: IntakeTargets | null): PrescriptionEvaluation {
  const volume = parseVolume(draft.volume);
  const { hours, errors: scheduleErrors } = scheduleOf(draft);
  const formula = draft.formula;
  let errors: PrescriptionErrors = { ...scheduleErrors };

  if (formula === null) {
    errors = { ...errors, formula: FORMULA_REQUIRED_HINT };
  } else if (!hasDensity(formula.kcalPerMl) || !hasDensity(formula.proteinPerMl)) {
    errors = { ...errors, formula: FORMULA_NO_DENSITY_HINT };
  }
  if (volume === null) {
    errors = { ...errors, volume: VOLUME_INVALID_HINT };
  }
  const valid = Object.keys(errors).length === 0;

  if (formula === null || errors.formula || volume === null || hours === null) {
    return { errors, intake: null, valid };
  }
  const rate = volume / hours;
  const kcal = round(rate * hours * (formula.kcalPerMl as number), 1);
  const protein = round(rate * hours * (formula.proteinPerMl as number), 1);

  return {
    errors,
    intake: {
      hours,
      kcal,
      kcalPercent: targets ? Math.round((kcal / targets.kcalPerDay) * 100) : null,
      protein,
      proteinPercent: targets ? Math.round((protein / targets.proteinPerDay) * 100) : null,
      rateMlPerHour: round(rate, 1),
    },
    valid,
  };
}

/** Monta a prescrição a gravar; `null` se o rascunho não é salvável. */
export function toPrescription(
  draft: PrescriptionDraft,
  context: { readonly at: string; readonly author: string },
): Prescription | null {
  const evaluation = evaluatePrescription(draft, null);
  const volume = parseVolume(draft.volume);
  const formula = draft.formula;

  if (!evaluation.valid || formula === null || volume === null) {
    return null;
  }

  return {
    at: context.at,
    author: context.author,
    formulaId: formula.id,
    formulaName: formula.name,
    kcalPerMl: formula.kcalPerMl as number,
    modality: draft.modality,
    nursingNotes: draft.nursingNotes.trim(),
    pauseTimes: draft.modality === 'continuous' ? [] : [...draft.pauseTimes].sort((a, b) => a.localeCompare(b)),
    proteinPerMl: formula.proteinPerMl as number,
    startTime: draft.startTime,
    volumeMl: volume,
  };
}

export function modalityLabel(modality: AdministrationModality): string {
  return MODALITY_OPTIONS.find(o => o.id === modality)?.label ?? '';
}

/** Ex.: "Início 08:00" ou "Início 08:00 · pausa 20:00, 22:00". */
export function scheduleText(prescription: Prescription): string {
  const start = `Início ${prescription.startTime}`;

  return prescription.pauseTimes.length === 0 ? start : `${start} · pausa ${prescription.pauseTimes.join(', ')}`;
}
