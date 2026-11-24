import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { PhIconComponent } from '../../../shared/icons/ph-icon/ph-icon.component';

export interface MeasurePoint {
  readonly label: string;
  /** Texto do tooltip depois da data (ex.: "balança"). */
  readonly note?: string;
  readonly value: number;
}

export type MeasurePeriod = 'stay' | '30d' | '7d';

export interface MeasureBadge {
  readonly icon: 'arrow-up' | 'arrow-down' | 'check';
  readonly text: string;
}

const PERIODS: readonly { readonly key: MeasurePeriod; readonly label: string; readonly count: number }[] = [
  { count: Number.POSITIVE_INFINITY, key: 'stay', label: 'Internação' },
  { count: 30, key: '30d', label: '30 dias' },
  { count: 7, key: '7d', label: '7 dias' },
];

// Geometria do v2/TrendChart (Figma 4623:5273, quadro "grafico" 501x148): linhas de grade em y 8 / 60,5 / 113, base da
// área em y 126; o gráfico começa 32px à direita da borda (rótulos do eixo) e passa 5px da borda direita.
const CHART_TOP = 8;
const CHART_BOTTOM = 113;
const CHART_AREA_BASE = 126;
const TICKS = 3;
const STEPS = [0.5, 1, 2, 5, 10, 20, 50];
const MIN_LABEL_GAP = 0.18;

export interface ChartPoint {
  readonly frac: number;
  readonly index: number;
  readonly label: string;
  readonly note: string;
  readonly value: number;
  readonly y: number;
}

/**
 * Gráfico de linha de uma medida do paciente (Peso, IMC) — componente `v2/TrendChart` do Figma (4623:5273 / 4623:5322):
 * valor atual e legenda, selo de variação, grade de 3 linhas, linha de referência tracejada, faixa ideal opcional,
 * pontos clicáveis com tooltip e filtro de período. Dados provisórios até o backend de medidas existir.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhIconComponent],
  selector: 'app-measure-chart',
  styleUrl: './measure-chart.component.scss',
  templateUrl: './measure-chart.component.html',
})
export class MeasureChartComponent {
  readonly title = input.required<string>();
  readonly unit = input.required<string>();
  readonly caption = input<string>('');
  readonly series = input.required<readonly MeasurePoint[]>();
  readonly badge = input<MeasureBadge | null>(null);
  /** Faixa ideal (ex.: IMC 18,5–24,9), desenhada em verde atrás da linha. */
  readonly idealRange = input<readonly [number, number] | null>(null);
  /** Linha tracejada de referência (ex.: peso da internação, início da faixa ideal) e o texto dela. */
  readonly reference = input<{ readonly label: string; readonly value: number } | null>(null);
  readonly decimals = input(1);

  protected readonly periods = PERIODS;
  protected readonly period = signal<MeasurePeriod>('stay');
  protected readonly picked = signal<number | null>(null);
  protected readonly areaBase = CHART_AREA_BASE;

  protected readonly visible = computed<readonly MeasurePoint[]>(() => {
    const count = PERIODS.find(p => p.key === this.period())?.count ?? Number.POSITIVE_INFINITY;
    const all = this.series();

    return Number.isFinite(count) ? all.slice(-count) : all;
  });

  protected readonly current = computed(() => this.format(this.series().at(-1)?.value ?? null));

  /** Três linhas de grade com passo "redondo" que cobre a série (ex.: 48/50/52 e 18/19/20). */
  protected readonly ticks = computed(() => {
    const values = this.visible().map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = STEPS.find(s => Math.floor(min / s) * s + s * (TICKS - 1) >= max) ?? STEPS[STEPS.length - 1];
    const first = Math.floor(min / step) * step;
    const last = first + step * (TICKS - 1);
    const rows = Array.from({ length: TICKS }, (_, i) => first + step * i);

    return { first, last, rows: rows.map(v => ({ label: this.format(v, 0), v, y: this.yOf(v, first, last) })) };
  });

  protected readonly points = computed<readonly ChartPoint[]>(() => {
    const data = this.visible();
    const { first, last } = this.ticks();

    return data.map((p, index) => ({
      frac: data.length > 1 ? index / (data.length - 1) : 0,
      index,
      label: p.label,
      note: `${p.label}${p.note ? ' · ' + p.note : ''}`,
      value: p.value,
      y: this.yOf(p.value, first, last),
    }));
  });

  /** Ponto escolhido (padrão: o penúltimo, como no Figma). */
  protected readonly selectedIndex = computed(() => {
    const count = this.points().length;
    const chosen = this.picked();

    if (chosen !== null && chosen < count) {
      return chosen;
    }

    return count > 2 ? count - 2 : count - 1;
  });

  protected readonly selected = computed(() => this.points()[this.selectedIndex()] ?? null);

  protected readonly line = computed(() =>
    this.points()
      .map(p => `${p.frac * 100},${p.y}`)
      .join(' '),
  );

  protected readonly areaPolygon = computed(() => {
    const pts = this.points();

    return pts.length === 0
      ? ''
      : `${pts[0].frac * 100},${CHART_AREA_BASE} ${this.line()} ${pts[pts.length - 1].frac * 100},${CHART_AREA_BASE}`;
  });

  protected readonly referenceLine = computed(() => {
    const ref = this.reference();
    const { first, last } = this.ticks();

    return ref ? { label: ref.label, y: this.yOf(ref.value, first, last) } : null;
  });

  protected readonly ideal = computed(() => {
    const range = this.idealRange();
    const { first, last } = this.ticks();

    if (!range) {
      return null;
    }
    const top = Math.max(CHART_TOP, this.yOf(range[1], first, last));
    const bottom = Math.min(CHART_BOTTOM, this.yOf(range[0], first, last));

    return { height: Math.max(0, bottom - top), y: top };
  });

  /** Rótulos do eixo X: o escolhido, o último, o primeiro e os que couberem sem encostar. */
  protected readonly axisLabels = computed(() => {
    const pts = this.points();
    const picked: ChartPoint[] = [];
    const priority = [this.selectedIndex(), pts.length - 1, 0, ...pts.map((_, i) => i)];

    for (const index of priority) {
      const point = pts[index];

      if (point && picked.every(p => Math.abs(p.frac - point.frac) >= MIN_LABEL_GAP)) {
        picked.push(point);
      }
    }

    return picked.sort((a, b) => a.index - b.index);
  });

  protected readonly summary = computed(
    () =>
      `${this.title()}: ${this.visible()
        .map(p => `${p.label} ${this.format(p.value)}`)
        .join(', ')}`,
  );

  protected select(key: MeasurePeriod): void {
    this.period.set(key);
    this.picked.set(null);
  }

  protected pick(index: number): void {
    this.picked.set(index);
  }

  protected format(value: number | null, digits = this.decimals()): string {
    return value === null
      ? '—'
      : value.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }

  private yOf(value: number, first: number, last: number): number {
    return CHART_BOTTOM - ((value - first) / (last - first || 1)) * (CHART_BOTTOM - CHART_TOP);
  }
}
