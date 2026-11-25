import { environment } from '@environments/environment';

import { GlimCriterionId, GlimCriterionState, GlimReading, GlimSeverity } from '../diagnosis/diagnosis.models';
import { NutritionFunctionalAssessment } from './assessment/assessment.models';
import { ClinicalAssessment } from './clinical-assessment/clinical-assessment.models';
import { DailyEvolution } from './daily-record/daily-record.models';
import { CurrentRoute, NutritionRoute } from './plan/plan.models';
import { CalculatedWeights, NutritionTargets } from './plan/plan-targets';
import { Prescription } from './prescription/prescription.models';

/**
 * Dados clínicos FICTÍCIOS de demonstração das fontes provisórias (que só guardam em memória ou no navegador), para
 * os pacientes numerados do seed de dev do back-end (`db/dev-demo`). Só valem no modo local (`devBackend`) e em
 * pacientes com id numérico; os pacientes 10, 11 e 18 não começaram a terapia e ficam sem dados (estado vazio).
 */
const WITHOUT_DATA: ReadonlySet<number> = new Set([10, 11, 18]);

/** Número do paciente de demonstração, ou `null` fora do modo local, para id não numérico e para quem não tem dados. */
export function demoSlot(patientId: string): number | null {
  if (!environment.devBackend || !/^\d+$/.test(patientId)) {
    return null;
  }
  const slot = Number(patientId);

  return WITHOUT_DATA.has(slot) ? null : slot;
}

const pick = <T>(list: readonly T[], slot: number): T => list[slot % list.length];

/** Ponto de partida do dia 0 da internação, em dias atrás (espelha as datas do seed SQL). */
const DAYS_AGO: Readonly<Record<number, number>> = {
  1: 28,
  2: 21,
  3: 17,
  4: 14,
  5: 10,
  6: 8,
  7: 5,
  8: 4,
  9: 2,
  12: 12,
  13: 24,
  14: 15,
  15: 9,
  16: 6,
  17: 3,
};

export function demoDiagnosis(patientId: string): GlimReading | undefined {
  const slot = demoSlot(patientId);

  if (slot === null) {
    return undefined;
  }
  const variant = slot % 4;
  const state = (positive: boolean): GlimCriterionState => (positive ? 'positive' : 'negative');
  const criteria: Record<GlimCriterionId, GlimCriterionState> = {
    inflammation: state(variant !== 0),
    'low-bmi': state(variant === 2),
    'low-muscle-mass': variant === 3 ? 'not-evaluated' : state(variant >= 2),
    'reduced-intake': state(variant !== 0),
    'weight-loss': state(variant !== 0),
  };
  const severity: Partial<Record<'weight-loss' | 'low-bmi', GlimSeverity>> =
    variant === 0 ? {} : { 'weight-loss': variant === 2 ? 'severe' : 'moderate' };

  return {
    criteria,
    fluidRetention: variant === 1,
    protocols: [
      { id: 'nrs-2002', label: 'NRS-2002', points: 2 + variant, result: variant === 0 ? 'Sem risco' : 'Risco' },
      { id: 'sarc-f', label: 'SARC-F', points: variant * 2, result: variant >= 2 ? 'Risco' : 'Sem risco' },
    ],
    screeningPositive: variant !== 0,
    severity,
  };
}

export function demoHypothesis(patientId: string): string | undefined {
  const slot = demoSlot(patientId);

  if (slot === null) {
    return undefined;
  }

  return pick(
    [
      'Desnutrição relacionada à doença com inflamação aguda, por ingestão reduzida e perda de peso no período.',
      'Insuficiência respiratória aguda; risco nutricional elevado por jejum prolongado e uso de ventilação.',
      'Pós-operatório de cirurgia abdominal de grande porte, com íleo funcional e necessidade de suporte nutricional.',
      'Doença renal crônica agudizada com restrição proteica e perda de massa muscular.',
      'Pneumonia grave com sarcopenia sugestiva e baixa aceitação de dieta oral.',
    ],
    slot,
  );
}

/** Intervalos de cada item, no desenho do Figma; só o valor muda por paciente. */
export function demoClinicalAssessment(patientId: string, base: ClinicalAssessment): ClinicalAssessment | undefined {
  const slot = demoSlot(patientId);

  if (slot === null) {
    return undefined;
  }
  const values: Readonly<Record<string, string>> = {
    'angulo-fase': (3 + (slot % 6) * 0.7).toFixed(1).replace('.', ','),
    glicemia: pick(['95–140', '120–190', '183–257'], slot),
    glim: String(slot % 3),
    handgrip: String(12 + (slot % 14)),
    intestino: String(slot % 6),
    nrs: String(pick([1, 4, 6, 3, 5], slot)),
    panturrilha: String(28 + (slot % 9)),
    sarcf: String(slot % 8),
  };
  const weight = 48 + slot * 2;

  return {
    ...base,
    device: pick(['SNE', 'SNG', 'GTT', 'Oral'], slot),
    heightCm: 150 + (slot % 25),
    items: base.items.map(item => ({ ...item, value: values[item.id] ?? item.value })),
    previousWeight: { at: '20/11', kg: weight - 1.4 },
    tnType: pick(['NE', 'NE', 'NP', 'Oral'], slot),
    weightKg: weight,
  };
}

export function demoAssessment(patientId: string): NutritionFunctionalAssessment | undefined {
  const slot = demoSlot(patientId);

  if (slot === null) {
    return undefined;
  }
  const weight = 48 + slot * 2;
  const format = (n: number): string => n.toFixed(1).replace('.', ',');

  return {
    previous: { weight: { at: '2026-11-18T12:00:00', value: format(weight - 1.4) } },
    values: { handgrip: String(12 + (slot % 14)), height: String(150 + (slot % 25)), weight: format(weight) },
  };
}

export function demoPrescriptions(patientId: string): readonly Prescription[] | undefined {
  const slot = demoSlot(patientId);

  if (slot === null) {
    return undefined;
  }
  const formula = pick(
    [
      { id: 'enteral-1', kcal: 1, name: 'Fórmula polimérica 1.0', protein: 0.04 },
      { id: 'enteral-2', kcal: 1.5, name: 'Fórmula hipercalórica com fibras', protein: 0.06 },
    ],
    slot,
  );
  const ago = DAYS_AGO[slot] ?? 3;
  const at = new Date(Date.now() - Math.max(ago - 2, 0) * 86_400_000);

  at.setHours(13, 33, 0, 0);

  return [
    {
      at: at.toISOString().slice(0, 19),
      author: pick(['Dr. Bruno Tavares', 'Dra. Ana Carolina Lopes', 'Dr. Rafael Dutra'], slot),
      formulaId: formula.id,
      formulaName: formula.name,
      kcalPerMl: formula.kcal,
      modality: 'continuous',
      nursingNotes: '',
      pauseTimes: [],
      proteinPerMl: formula.protein,
      route: pick<NutritionRoute>(['NE', 'NE', 'NE', 'NE'], slot),
      startTime: '08:00',
      volumeMl: 600 + (slot % 7) * 100,
    },
  ];
}

export function demoRoute(patientId: string): CurrentRoute | undefined {
  const slot = demoSlot(patientId);

  if (slot === null) {
    return undefined;
  }
  const since = new Date(Date.now() - Math.max((DAYS_AGO[slot] ?? 3) - 2, 0) * 86_400_000);

  since.setHours(12, 0, 0, 0);

  return { routes: [pick<NutritionRoute>(['NE', 'NE', 'NE', 'NE'], slot)], since: since.toISOString().slice(0, 19) };
}

export function demoTargets(patientId: string): NutritionTargets | undefined {
  const slot = demoSlot(patientId);

  if (slot === null) {
    return undefined;
  }
  const weight = 48 + slot * 2;
  const kcalPerKg = pick([25, 27, 30, 22], slot);
  const proteinPerKg = pick([1.5, 1.2, 1.8, 1.3], slot);

  return {
    calorimetry: null,
    formula: 'simplified',
    kcalPerDay: Math.round(weight * kcalPerKg),
    kcalPerKg,
    proteinPerDay: Math.round(weight * proteinPerKg * 10) / 10,
    proteinPerKg,
    referenceWeight: { kg: weight, kind: 'current' },
  };
}

export function demoWeights(patientId: string): CalculatedWeights | undefined {
  const slot = demoSlot(patientId);

  if (slot === null) {
    return undefined;
  }
  const weight = 48 + slot * 2;

  return { adjusted: weight - 3, current: weight, dry: weight - 1.5, ideal: weight - 8 };
}

/** Evolução médica do dia, para os dias entre a internação e hoje (nenhuma antes da internação). */
export function demoEvolution(patientId: string, day: string): DailyEvolution | undefined {
  const slot = demoSlot(patientId);

  if (slot === null) {
    return undefined;
  }
  const date = new Date(`${day}T12:00:00`);
  const ago = Math.round((Date.now() - date.getTime()) / 86_400_000);
  const start = DAYS_AGO[slot] ?? 3;

  if (ago < 0 || ago > start) {
    return undefined;
  }
  const texts = [
    'Dieta bem tolerada, sem resíduo gástrico. Evacuações presentes. Manter plano e acompanhar glicemia.',
    'Discreta distensão abdominal; reduzir velocidade de infusão em 20% e reavaliar em 24 h.',
    'Ingestão oral parcial (50%). Associar suplemento hiperproteico duas vezes ao dia.',
    'Paciente em melhora clínica, desmame de sedação. Progredir meta calórica para 80%.',
    'Episódios de diarreia (3 em 24 h). Suspender fibras e revisar medicações; reavaliar em 48 h.',
  ];
  const due = new Date(date.getTime() + 2 * 86_400_000);

  date.setHours(10 + (ago % 5), 15, 0, 0);

  return {
    at: date.toISOString().slice(0, 19),
    author: pick(['Dr. Bruno Tavares', 'Dra. Ana Carolina Lopes', 'Dr. Rafael Dutra'], slot),
    origin: 'manual',
    reevaluations:
      ago % 4 === 1 ? [{ dueAt: due.toISOString().slice(0, 19), id: `demo-${slot}-${ago}`, name: 'Diarreia' }] : [],
    text: texts[(slot + ago) % texts.length],
  };
}
