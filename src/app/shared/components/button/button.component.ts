import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';

/**
 * Mapeia a propriedade Figma `type` (specs/ds/DS-component-button/spec.md) — renomeada
 * para não colidir com o atributo HTML nativo `type` do elemento `<button>`.
 */
export type ButtonKind = 'primary' | 'secondary' | 'tertiary';

/**
 * Mapeia a propriedade Figma `variant` — renomeada para não ambiguar com "variant"
 * genérico de outros componentes Angular.
 */
export type ButtonAppearance = 'solid' | 'outlined';

/**
 * Botão de design system (DS-component-button). `disabled` renderiza uma única
 * aparência independente de `kind`/`appearance` — decisão registrada em
 * spec.md § Clarifications (Sessão 2026-07-23), pois o Figma unificou o estado
 * `Enable=False` para todo o component set.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhIconComponent],
  selector: 'app-button',
  styleUrl: './button.component.scss',
  templateUrl: './button.component.html',
})
export class ButtonComponent {
  readonly kind = input<ButtonKind>('primary');
  readonly appearance = input<ButtonAppearance>('solid');
  readonly disabled = input<boolean>(false);
  readonly iconLeft = input<string | null>(null);
  readonly iconRight = input<string | null>(null);
  readonly fullWidth = input<boolean>(false);
  readonly label = input.required<string>();

  protected readonly variantClass = computed(() => `button--${this.kind()} button--${this.appearance()}`);
}
