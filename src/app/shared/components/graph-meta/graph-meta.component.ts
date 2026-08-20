import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Variante de tamanho do frame Figma `graph-meta` (4369:6239).
 *
 * Em minúsculas, como TODO o resto do design system (`'default'`/`'small'` em
 * `avatar`, `icon-button`, `drawer`, `bottom-sheet`). Os valores capitalizados
 * originais vinham colados do nome da propriedade no Figma e faziam deste o único
 * componente com convenção própria de API.
 */
export type GraphMetaSize = 'default' | 'small';

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function progressDasharray(halfCircumference: number, percentage: number): string {
  const progressLength = halfCircumference * (percentage / 100);
  const fullCircumference = halfCircumference * 2;

  return `${progressLength} ${fullCircumference - progressLength}`;
}

/**
 * 4 faixas independentes por arco (research.md §3): 0% é seu próprio nível
 * (disabled), não parte de "<=10%" — evita a sobreposição de regras do
 * enunciado original. `normalColor` diferencia o arco de topo (verde) do de
 * base (azul) apenas na faixa 50–100%; as demais faixas são iguais para os
 * dois arcos.
 *
 * Corte em `value < 50` (não `value <= 49`): valores decimais no intervalo
 * aberto (49, 50) — ex.: 49.5% — MUST permanecer na faixa de aviso
 * (11–49%, spec.md § Edge Cases), não "vazar" para a faixa ≥50% só porque
 * ultrapassam o inteiro 49 (achado de /speckit-converge, T013).
 */
function colorForPercentage(value: number, normalColor: string): string {
  if (value === 0) {
    return 'var(--color-state-disabled)';
  }
  if (value <= 10) {
    return 'var(--color-comm-alert)';
  }
  if (value < 50) {
    return 'var(--color-comm-warning)';
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
 * (research.md §3): 0% → disabled; 1–10% → alerta (vermelho); 11–49% → aviso
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

  protected readonly clampedTop = computed(() => clamp(this.topPercentage()));
  protected readonly clampedBottom = computed(() => clamp(this.bottomPercentage()));

  // Diâmetro nominal do frame Figma: 48 (Default) / 32 (Small). Espessura de
  // traço proporcional (6 em 48) — não corresponde a nenhuma variável Figma
  // retornada por get_variable_defs (research.md §5), mantida como constante
  // derivada do diâmetro, não um token.
  protected readonly diameter = computed(() => (this.size() === 'small' ? 32 : 48));
  protected readonly strokeWidth = computed(() => this.diameter() / 8);

  protected readonly center = computed(() => this.diameter() / 2);
  protected readonly outerRadius = computed(() => this.diameter() / 2 - this.strokeWidth() / 2);
  protected readonly innerRadius = computed(() => this.diameter() / 4 - this.strokeWidth() / 2);

  protected readonly viewBoxHeight = computed(() => this.outerRadius() + this.strokeWidth());
  protected readonly cy = computed(() => this.outerRadius() + this.strokeWidth() / 2);
  protected readonly rotation = computed(() => `rotate(180 ${this.center()} ${this.cy()})`);

  protected readonly outerHalfCircumference = computed(() => Math.PI * this.outerRadius());
  protected readonly innerHalfCircumference = computed(() => Math.PI * this.innerRadius());

  protected readonly outerTrackDasharray = computed(
    () => `${this.outerHalfCircumference()} ${this.outerHalfCircumference()}`,
  );
  protected readonly innerTrackDasharray = computed(
    () => `${this.innerHalfCircumference()} ${this.innerHalfCircumference()}`,
  );

  protected readonly outerProgressDasharray = computed(() =>
    progressDasharray(this.outerHalfCircumference(), this.clampedTop()),
  );
  protected readonly innerProgressDasharray = computed(() =>
    progressDasharray(this.innerHalfCircumference(), this.clampedBottom()),
  );

  protected readonly outerColor = computed(() => colorForPercentage(this.clampedTop(), 'var(--color-comm-success)'));
  protected readonly innerColor = computed(() => colorForPercentage(this.clampedBottom(), 'var(--color-content-2)'));
}
