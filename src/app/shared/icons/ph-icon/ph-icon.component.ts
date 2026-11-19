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
 * Wrapper fino sobre `@phosphor-icons/web`. Uso: `<ph-icon name="gear" weight="bold" /> (o padrão é "regular")`.
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
  // Padrão do design system (Figma, 2026-11-19): ícone em "regular". "bold" só em estado ativo
  // ou desabilitado do controle (e no ícone de Sair do menu, que é sempre bold).
  readonly weight = input<PhIconWeight>('regular');
  readonly size = input<number>(24);

  protected readonly iconClass = computed(() => `${WEIGHT_CLASS[this.weight()]} ph-${this.name()}`);
}
