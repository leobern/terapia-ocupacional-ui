import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Peso do ícone Phosphor — espelha a propriedade "weight" já parametrizada no
 * componente de ícone do Figma (ver specs/003-home/research.md §1), para que a
 * migração de um ícone do protótipo não exija aprender uma API nova.
 */
export type PhIconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

const WEIGHT_CLASS: Record<PhIconWeight, string> = {
  thin: 'ph-thin',
  light: 'ph-light',
  regular: 'ph',
  bold: 'ph-bold',
  fill: 'ph-fill',
  duotone: 'ph-duotone',
};

/**
 * Wrapper fino sobre `@phosphor-icons/web`. Uso: `<ph-icon name="gear" weight="bold" />`.
 *
 * Não desenha ícones à mão (Constituição, Princípio VIII) — apenas resolve o
 * nome/peso para as classes CSS da lib, já carregadas globalmente em styles.scss.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ph-icon',
  styleUrl: './ph-icon.component.scss',
  template: `<i aria-hidden="true" [class]="iconClass()" [style.fontSize.px]="size()"></i>`,
})
export class PhIconComponent {
  readonly name = input.required<string>();
  // Design system usa exclusivamente o peso "bold" (ajuste visual pedido
  // pelo usuário) — outros pesos continuam suportados pela lib, mas não são
  // mais o padrão do app.
  readonly weight = input<PhIconWeight>('bold');
  readonly size = input<number>(24);

  protected readonly iconClass = computed(() => `${WEIGHT_CLASS[this.weight()]} ph-${this.name()}`);
}
