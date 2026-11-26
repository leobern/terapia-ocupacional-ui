import type { MeasureBadge, MeasurePoint } from './charts/measure-chart.component';
import { MeasurementPoint, PatientMeasures } from './measures-source';

/** Dados de um gráfico (`app-measure-chart`) já formatados. */
export interface MeasureChartView {
  readonly badge: MeasureBadge | null;
  readonly caption: string;
  readonly idealRange: readonly [number, number] | null;
  readonly reference: { readonly label: string; readonly value: number } | null;
  readonly series: readonly MeasurePoint[];
}

/** Os dois gráficos; `null` = sem dado para desenhar (estado vazio: o gráfico não aparece). */
export interface MeasuresView {
  readonly bmi: MeasureChartView | null;
  readonly weight: MeasureChartView | null;
}

const SOURCE_NOTE = 'avaliação clínica';

const decimal = (value: number): string => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const two = (value: number): string => String(value).padStart(2, '0');
const dayLabel = (date: Date): string => `${two(date.getDate())}/${two(date.getMonth() + 1)}`;
const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function toSeries(points: readonly MeasurementPoint[], pick: (p: MeasurementPoint) => number): MeasurePoint[] {
  return points.map(p => {
    const date = new Date(p.at);

    return {
      label: dayLabel(date),
      note: `${SOURCE_NOTE} · ${two(date.getHours())}:${two(date.getMinutes())}`,
      value: pick(p),
    };
  });
}

function caption(points: readonly MeasurementPoint[], today: Date): string {
  const last = new Date(points[points.length - 1].at);
  const when = isSameDay(last, today) ? `hoje, ${dayLabel(last)}` : `em ${dayLabel(last)}`;
  const count = points.length === 1 ? '1 medição' : `${points.length} medições`;

  return `Medido ${when} · ${count}`;
}

function weightChart(measures: PatientMeasures, today: Date): MeasureChartView | null {
  const { points } = measures;

  if (points.length === 0) {
    return null;
  }
  const delta = Math.round((points[points.length - 1].weightKg - points[0].weightKg) * 10) / 10;
  const since = dayLabel(new Date(points[0].at));
  let badge: MeasureBadge | null = null;

  if (points.length > 1) {
    badge =
      delta === 0
        ? { icon: 'check', text: `Estável desde ${since}` }
        : {
            icon: delta > 0 ? 'arrow-up' : 'arrow-down',
            text: `${delta > 0 ? '+' : '−'}${decimal(Math.abs(delta))} kg desde ${since}`,
          };
  }
  const admission = measures.admissionWeightKg;

  return {
    badge,
    caption: caption(points, today),
    idealRange: null,
    reference: admission === null ? null : { label: `Internação · ${decimal(admission)} kg`, value: admission },
    series: toSeries(points, p => p.weightKg),
  };
}

const inRange = (point: MeasurementPoint, min: number, max: number): boolean =>
  point.bmi !== null && point.bmi >= min && point.bmi <= max;

/** Início do trecho final de medições dentro da faixa ideal (o "desde" do selo). */
function inRangeSince(points: readonly MeasurementPoint[], min: number, max: number): MeasurementPoint {
  let index = points.length - 1;

  while (index > 0 && inRange(points[index - 1], min, max)) {
    index--;
  }

  return points[index];
}

function bmiChart(measures: PatientMeasures): MeasureChartView | null {
  const points = measures.points.filter(p => p.bmi !== null);

  if (points.length === 0) {
    return null;
  }
  const { max, min } = measures.bmiIdealRange;
  const last = points[points.length - 1];
  let badge: MeasureBadge;

  if ((last.bmi ?? 0) < min) {
    badge = { icon: 'arrow-down', text: 'Abaixo da faixa ideal' };
  } else if ((last.bmi ?? 0) > max) {
    badge = { icon: 'arrow-up', text: 'Acima da faixa ideal' };
  } else {
    badge = { icon: 'check', text: `Na faixa ideal desde ${dayLabel(new Date(inRangeSince(points, min, max).at))}` };
  }
  const height =
    last.heightCm === null
      ? ''
      : `Altura ${(last.heightCm / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m · `;

  return {
    badge,
    caption: `${height}${height === '' ? 'Faixa' : 'faixa'} ideal ${decimal(min)}–${decimal(max)}`,
    idealRange: [min, max],
    reference: { label: `${decimal(min)} · início da faixa ideal`, value: min },
    series: toSeries(points, p => p.bmi ?? 0),
  };
}

/** Monta os gráficos de Peso e IMC; o IMC só usa medições com altura (nada é inventado nem herdado). */
export function buildMeasuresView(measures: PatientMeasures, today: Date): MeasuresView {
  return { bmi: bmiChart(measures), weight: weightChart(measures, today) };
}
