import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface MeasurePoint {
  readonly label: string;
  readonly value: number;
}

export type MeasurePeriod = 'stay' | '30d' | '7d';

const PERIODS: readonly { readonly key: MeasurePeriod; readonly label: string; readonly count: number }[] = [
  { count: Number.POSITIVE_INFINITY, key: 'stay', label: 'Internação' },
  { count: 30, key: '30d', label: '30 dias' },
  { count: 7, key: '7d', label: '7 dias' },
];

const WIDTH = 300;
const HEIGHT = 110;
const PAD_X = 8;
const PAD_Y = 12;

/**
 * Gráfico de linha de uma medida do paciente (Peso, IMC) — Figma 4608:4845/4608:4375. Mostra o valor atual, a legenda,
 * a série no período escolhido (Internação / 30 dias / 7 dias) e, opcionalmente, a faixa ideal (IMC).
 * Dados provisórios até o backend de medidas existir.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-measure-chart',
  styleUrl: './measure-chart.component.scss',
  templateUrl: './measure-chart.component.html',
})
export class MeasureChartComponent {
  readonly title = input.required<string>();
  readonly unit = input.required<string>();
  readonly caption = input<string>('');
  readonly series = input.required<readonly MeasurePoint[]>();
  /** Faixa ideal (ex.: IMC 18,5–24,9), desenhada em verde atrás da linha. */
  readonly idealRange = input<readonly [number, number] | null>(null);

  protected readonly periods = PERIODS;
  protected readonly period = signal<MeasurePeriod>('stay');
  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;

  protected readonly visible = computed<readonly MeasurePoint[]>(() => {
    const count = PERIODS.find(p => p.key === this.period())?.count ?? Number.POSITIVE_INFINITY;
    const all = this.series();

    return Number.isFinite(count) ? all.slice(-count) : all;
  });

  protected readonly current = computed(() => this.series().at(-1)?.value ?? null);

  protected readonly bounds = computed(() => {
    const values = this.visible().map(p => p.value);
    const range = this.idealRange();
    const all = range ? [...values, ...range] : values;
    const min = Math.min(...all);
    const max = Math.max(...all);
    const margin = (max - min || 1) * 0.1;

    return { max: max + margin, min: min - margin };
  });

  protected readonly points = computed(() => {
    const data = this.visible();
    const { max, min } = this.bounds();
    const stepX = data.length > 1 ? (WIDTH - PAD_X * 2) / (data.length - 1) : 0;

    return data.map((point, index) => ({
      label: point.label,
      value: point.value,
      x: PAD_X + stepX * index,
      y: this.scaleY(point.value, min, max),
    }));
  });

  protected readonly line = computed(() =>
    this.points()
      .map(p => `${p.x},${p.y}`)
      .join(' '),
  );

  protected readonly area = computed(() => {
    const pts = this.points();

    return pts.length === 0 ? '' : `${pts[0].x},${HEIGHT} ${this.line()} ${pts[pts.length - 1].x},${HEIGHT}`;
  });

  protected readonly ideal = computed(() => {
    const range = this.idealRange();
    const { max, min } = this.bounds();

    if (!range) {
      return null;
    }
    const top = this.scaleY(range[1], min, max);

    return { height: this.scaleY(range[0], min, max) - top, y: top };
  });

  protected readonly summary = computed(
    () =>
      `${this.title()}: ${this.visible()
        .map(p => `${p.label} ${p.value}`)
        .join(', ')}`,
  );

  protected select(key: MeasurePeriod): void {
    this.period.set(key);
  }

  private scaleY(value: number, min: number, max: number): number {
    return HEIGHT - PAD_Y - ((value - min) / (max - min)) * (HEIGHT - PAD_Y * 2);
  }
}
