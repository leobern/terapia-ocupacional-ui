import type { MeasurePoint } from './charts/measure-chart.component';

/** Séries provisórias de peso (kg) e IMC (kg/m²) do Figma 4608:4845 — até o backend de medidas existir. */
export const PROVISIONAL_WEIGHT: readonly MeasurePoint[] = [
  { label: '01/05', value: 48.5 },
  { label: '10/05', value: 49.4 },
  { label: '15/05', value: 49.9 },
  { label: '18/05', value: 50.2 },
  { label: '20/05', note: 'balança', value: 50.4 },
  { label: '28/05', value: 51 },
];

export const PROVISIONAL_BMI: readonly MeasurePoint[] = [
  { label: '01/05', value: 18.2 },
  { label: '10/05', value: 18.5 },
  { label: '15/05', value: 18.7 },
  { label: '18/05', value: 18.9 },
  { label: '20/05', note: 'calculado', value: 19 },
  { label: '28/05', value: 19.2 },
];
