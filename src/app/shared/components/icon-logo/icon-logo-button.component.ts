import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { KeyboardFocusService } from '../../services/keyboard-focus.service';
import { IconLogoVisualComponent, type IconLogoVisualState } from './icon-logo-visual.component';

/**
 * Símbolo da IA do Conductia como **controle clicável** (DS-component-icon-logo).
 *
 * `ariaLabel` é `input.required()` porque não há texto visível: este é o único nome
 * acessível do botão, e omitir quebra a build em vez de gerar um aviso em runtime — mesmo
 * mecanismo já usado em `ButtonComponent`/`IconButtonComponent`. É essa exigência que
 * motivou separar este componente do decorativo `app-icon-logo` (spec.md § Clarifications,
 * 2026-07-26).
 *
 * `disabled` reusa o visual da variante Figma `State=disabled` e mantém o elemento no DOM
 * como `<button disabled>` — o idiomático em HTML, melhor que trocar de componente em
 * runtime (o foco saltaria e o layout piscaria).
 *
 * O anel de foco é o **sistêmico** do design system (`mixins.focus-ring` +
 * `KeyboardFocusService`), não um anel próprio: ver o docblock do serviço para por que o
 * projeto evita `:focus-visible` puro.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconLogoVisualComponent],
  selector: 'app-icon-logo-button',
  styleUrl: './icon-logo-button.component.scss',
  templateUrl: './icon-logo-button.component.html',
})
export class IconLogoButtonComponent {
  readonly ariaLabel = input.required<string>();
  readonly disabled = input<boolean>(false);

  /**
   * Repasse de `aria-expanded` ao `<button>` interno — mesmo contrato do
   * `app-icon-button`. `null` omite o atributo.
   */
  readonly ariaExpanded = input<boolean | null>(null);

  // `output()` sem argumento de tipo (e não `output<void>()`): o evento não carrega
  // payload, e escrever `void` como argumento genérico viola `no-invalid-void-type`.
  readonly clicked = output();

  protected readonly hovered = signal(false);

  // Mesma técnica do Button/IconButton — ver shared/services/keyboard-focus.service.ts.
  protected readonly keyboardFocused = signal(false);

  /** `disabled` mapeia para o visual `disabled` do Figma; caso contrário, o visual `button`. */
  protected readonly visualState = computed<IconLogoVisualState>(() => (this.disabled() ? 'disabled' : 'button'));

  /** Hover revela as 3 luzes ESTÁTICAS — é o que diferencia o hover do estado `anim`. */
  protected readonly lightsVisible = computed(() => this.hovered() && !this.disabled());

  private readonly keyboardFocusService = inject(KeyboardFocusService);

  protected onBlur(): void {
    this.keyboardFocused.set(false);
  }

  protected onClick(): void {
    if (this.disabled()) {
      return;
    }

    this.clicked.emit();
  }

  protected onFocus(): void {
    this.keyboardFocused.set(this.keyboardFocusService.isKeyboard());
  }
}
