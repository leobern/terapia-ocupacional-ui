import { GLIM_CRITERIA, GlimDiagnosis, GlimReading, GlimSeverity } from './diagnosis.models';

/** Grave se perda de peso ou IMC positivo for grave; senão moderada se algum for moderado. */
function stagingOf(reading: GlimReading): GlimSeverity | null {
  const grades = (['weight-loss', 'low-bmi'] as const)
    .filter(id => reading.criteria[id] === 'positive')
    .map(id => reading.severity[id]);

  if (grades.includes('severe')) {
    return 'severe';
  }

  return grades.includes('moderate') ? 'moderate' : null;
}

/**
 * Motor determinístico do GLIM (FT-004-5): só combina os estados dos 5 critérios já classificados.
 * - sem triagem positiva: não calcula;
 * - ≥1 fenotípico e ≥1 etiológico positivos: confirmada, com estadiamento por perda de peso e IMC;
 * - 5 avaliados e nenhum positivo: excluída;
 * - demais casos (parcialmente avaliados, ou só um dos grupos positivo): indeterminado.
 */
export function evaluateGlim(reading: GlimReading): GlimDiagnosis {
  if (!reading.screeningPositive) {
    return { outcome: 'no-screening', staging: null };
  }
  const positive = (group: 'phenotypic' | 'etiologic'): boolean =>
    GLIM_CRITERIA.some(c => c.group === group && reading.criteria[c.id] === 'positive');

  if (positive('phenotypic') && positive('etiologic')) {
    return { outcome: 'confirmed', staging: stagingOf(reading) };
  }
  const anyPositive = GLIM_CRITERIA.some(c => reading.criteria[c.id] === 'positive');
  const allEvaluated = GLIM_CRITERIA.every(c => reading.criteria[c.id] !== 'not-evaluated');

  return { outcome: allEvaluated && !anyPositive ? 'excluded' : 'indeterminate', staging: null };
}
