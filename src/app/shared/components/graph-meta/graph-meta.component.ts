import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Variante de tamanho do frame Figma `graph-meta` (4369:6239).
 *
 * Em minúsculas, como TODO o resto do design system (`'default'`/`'small'` em
 * `avatar`, `icon-button`, `drawer`, `bottom-sheet`). Os valores capitalizados
 * originais vinham colados do nome da propriedade no Figma e faziam deste o único
 * componente com convenção própria de API.
 */
export type GraphMetaSize = 'large' | 'default' | 'small';

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Figma v2 (`v2/MiniGauge`, `v2/CardPatients`): arco de 270°, abrindo para baixo. */
const SWEEP = 0.75;

function arcDasharray(circumference: number, percentage: number): string {
  const length = circumference * SWEEP * (percentage / 100);

  return `${length} ${circumference}`;
}

/**
 * 4 faixas independentes por arco (research.md §3): 0% é seu próprio nível
 * (disabled), não parte da faixa de alerta (<20%, RN-02 da US-003-2-03) — evita a sobreposição de regras do
 * enunciado original. `normalColor` diferencia o arco de topo (verde) do de
 * base (azul) apenas na faixa 50–100%; as demais faixas são iguais para os
 * dois arcos.
 *
 * Corte em `value < 50` (não `value <= 49`): valores decimais no intervalo
 * aberto (49, 50) — ex.: 49.5% — MUST permanecer na faixa de aviso
 * (20–49%), não "vazar" para a faixa ≥50% só porque
 * ultrapassam o inteiro 49 (achado de /speckit-converge, T013).
 */
function colorForPercentage(value: number, normalColor: string): string {
  if (value === 0) {
    return 'var(--color-state-disabled)';
  }
  if (value < 20) {
    return 'var(--color-comm-alert)';
  }
  if (value < 50) {
    // v2: amarelo "forte" para gráficos; comm-warning ficou só como fundo de aviso.
    return 'var(--color-comm-warning-strong)';
  }

  return normalColor;
}

/**
 * Gauge de meia-circunferência com dois arcos concêntricos (topo/base), cada
 * um representando um valor 0–100% totalmente independente do outro — sem
 * nenhum acoplamento entre `topPercentage` e `bottomPercentage`
 * (specs/ds/DS-component-graph-meta/spec.md § FR-002).
 *
 * Reaproveita a matemática de SVG já validada em produção por
 * `features/home/components/nutritional-goal-ring` (research.md §1): dois
 * `<circle>` concêntricos, viewBox recortada na linha do diâmetro,
 * `stroke-dasharray` proporcional ao percentual, `rotate(180 …)` para o arco
 * crescer da esquerda para a direita passando pelo topo. A altura do viewBox
 * reserva uma margem extra (`+ strokeWidth`) além do raio para a ponta
 * arredondada do traço (`stroke-linecap: round`) não ser cortada — por isso a
 * altura renderizada não é exatamente metade da largura.
 *
 * Cor de cada arco é resolvida por 4 faixas a partir do próprio valor
 * (research.md §3): 0% → disabled; 1–19% → alerta (vermelho, RN-02: abaixo de 20%); 20–49% → aviso
 * (amarelo); 50–100% → sucesso/verde no arco de topo, conteúdo/azul no de
 * base. O trilho (parte não preenchida) é sempre `--color-border` — o token
 * correto do nó Figma, não `--color-border-2` usado pela referência
 * (research.md §2, desvio corrigido nesta entry).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-graph-meta',
  styleUrl: './graph-meta.component.scss',
  templateUrl: './graph-meta.component.html',
})
export class GraphMetaComponent {
  readonly topPercentage = input.required<number>();
  readonly bottomPercentage = input.required<number>();
  readonly size = input<GraphMetaSize>('default');
  readonly ariaLabel = input.required<string>();
  /** Texto no centro do anel (ex.: nº de pacientes) — só no size="large". */
  readonly centerLabel = input<string>('');
  /** Os dois anéis ficam verdes (ex.: tudo concluído), em vez do verde e azul de cada aporte. */
  readonly allSuccess = input(false);

  protected readonly clampedTop = computed(() => clamp(this.topPercentage()));
  protected readonly clampedBottom = computed(() => clamp(this.bottomPercentage()));

  // Diâmetro nominal do frame Figma: 48 (Default) / 32 (Small). Espessura de
  // traço proporcional (6 em 48) — não corresponde a nenhuma variável Figma
  // retornada por get_variable_defs (research.md §5), mantida como constante
  // derivada do diâmetro, não um token.
  // large 88 (card de pacientes) · default 48 · small 40 (linha de paciente).
  protected readonly diameter = computed(() => ({ large: 88, default: 48, small: 40 })[this.size()]);
  protected readonly strokeWidth = computed(() => (this.size() === 'large' ? 8 : Math.round(this.diameter() * 0.14)));
  protected readonly innerDiameter = computed(() =>
    this.size() === 'large' ? 64 : Math.round(this.diameter() * 0.65),
  );

  protected readonly center = computed(() => this.diameter() / 2);
  protected readonly outerRadius = computed(() => this.diameter() / 2 - this.strokeWidth() / 2);
  protected readonly innerRadius = computed(() => this.innerDiameter() / 2 - this.strokeWidth() / 2);

  protected readonly viewBoxHeight = computed(() => this.diameter());
  protected readonly cy = computed(() => this.diameter() / 2);
  protected readonly rotation = computed(() => `rotate(135 ${this.center()} ${this.cy()})`);

  protected readonly outerCircumference = computed(() => 2 * Math.PI * this.outerRadius());
  protected readonly innerCircumference = computed(() => 2 * Math.PI * this.innerRadius());

  protected readonly outerTrackDasharray = computed(() => arcDasharray(this.outerCircumference(), 100));
  protected readonly innerTrackDasharray = computed(() => arcDasharray(this.innerCircumference(), 100));
  protected readonly outerProgressDasharray = computed(() =>
    arcDasharray(this.outerCircumference(), this.clampedTop()),
  );
  protected readonly innerProgressDasharray = computed(() =>
    arcDasharray(this.innerCircumference(), this.clampedBottom()),
  );

  protected readonly outerColor = computed(() => colorForPercentage(this.clampedTop(), 'var(--color-comm-success)'));
  protected readonly innerColor = computed(() =>
    colorForPercentage(
      this.clampedBottom(),
      this.allSuccess() ? 'var(--color-comm-success)' : 'var(--color-secondary)',
    ),
  );
}
