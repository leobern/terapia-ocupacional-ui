import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';

/** Mapeia a propriedade Figma `type` (specs/ds/DS-component-badge/spec.md). */
export type BadgeType = 'numeral' | 'icon' | 'color';

/**
 * Badge de sinalização flutuante (DS-component-badge), com 3 anatomias distintas
 * selecionadas por `type` — ao contrário de Button/IconButton, não é um controle
 * interativo (sem foco, sem clique próprio) e cada `type` usa um subconjunto diferente
 * de props (por isso nenhuma delas é `input.required()`, ver research.md §2).
 *
 * O host É a caixa visual do badge (sem `display: contents` nem `<div>` interno de
 * wrapper) — diferente de Button/IconButton. O badge "flutua" composto sobre outro
 * elemento via `style="position: absolute; ..."` aplicado diretamente na tag
 * `<app-badge>` pelo consumidor (spec.md § Diretrizes de Uso); `display: contents`
 * removeria o host do modelo de caixa e quebraria esse posicionamento.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
    '[style.background]': 'hostBackground()',
  },
  imports: [PhIconComponent],
  selector: 'app-badge',
  styleUrl: './badge.component.scss',
  templateUrl: './badge.component.html',
})
export class BadgeComponent {
  readonly type = input<BadgeType>('numeral');

  // Só usado quando type="numeral". Formatação: FR-002 (spec.md) — máximo 4
  // caracteres, "+999" fixo para qualquer valor acima de 999 (nunca o valor real).
  readonly value = input<number>(0);

  // Só usado quando type="icon".
  readonly icon = input<string>('');

  // "Qualquer cor" (input do usuário) — string CSS livre, não união fechada de tokens
  // (research.md §3). Defaults espelham o exemplo do protótipo Figma.
  readonly backgroundColor = input<string>('var(--color-comm-success)');
  readonly iconColor = input<string>('var(--color-content-6)');

  // Só usado quando type="color".
  readonly color = input<string>('var(--color-comm-alert)');

  protected readonly displayValue = computed(() => (this.value() > 999 ? '+999' : String(this.value())));

  protected readonly hostClass = computed(() => `badge badge--${this.type()}`);

  // type="numeral" tem fundo fixo via classe SCSS (FR-003) — sem binding aqui.
  // type="icon"/"color" recebem "qualquer cor" do consumidor (FR-004/FR-005).
  protected readonly hostBackground = computed(() => {
    switch (this.type()) {
      case 'icon':
        return this.backgroundColor();
      case 'color':
        return this.color();
      default:
        return null;
    }
  });
}
