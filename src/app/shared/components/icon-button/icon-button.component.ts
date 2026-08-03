import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { KeyboardFocusService } from '../../services/keyboard-focus.service';

/**
 * Mapeia a propriedade Figma `type` (specs/ds/DS-component-icon-button/spec.md) — mesma
 * convenção de nomenclatura do `ButtonComponent` (evita colisão com o atributo HTML
 * nativo `type` do elemento `<button>`).
 */
export type IconButtonKind = 'primary' | 'secondary' | 'tertiary';

/**
 * Mapeia a propriedade Figma `variant`. Tem uma variante a mais que `ButtonAppearance`
 * (`'icon'` — sem preenchimento nem borda, só o ícone).
 */
export type IconButtonAppearance = 'solid' | 'outlined' | 'icon';

/** Mapeia a propriedade Figma `size` (Default/Small). Prop nova — Button não tem `size`. */
export type IconButtonSize = 'default' | 'small';

/**
 * Botão de ícone de design system (DS-component-icon-button). Sempre renderiza um único
 * ícone central — nunca texto — por isso `icon` e `ariaLabel` são obrigatórios via
 * `input.required()`: qualquer template que omitir um dos dois falha em tempo de
 * compilação (Angular template type checking), sem necessidade de um teste dedicado —
 * mesmo padrão já usado pelo `label` obrigatório do `ButtonComponent`.
 *
 * `disabled` renderiza uma única aparência independente de `kind`/`appearance`/`size` —
 * decisão herdada do Button (spec.md § Estados), extrapolada para as 18 combinações
 * habilitadas a partir das 2 observadas no Figma.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhIconComponent],
  selector: 'app-icon-button',
  styleUrl: './icon-button.component.scss',
  templateUrl: './icon-button.component.html',
})
export class IconButtonComponent {
  readonly kind = input<IconButtonKind>('primary');
  readonly appearance = input<IconButtonAppearance>('solid');
  readonly size = input<IconButtonSize>('default');
  readonly disabled = input<boolean>(false);
  readonly icon = input.required<string>();
  readonly ariaLabel = input.required<string>();

  /**
   * Repasse de `aria-expanded` ao `<button>` interno, para quando este botão abre
   * uma superfície que o CONSUMIDOR monta (menu, bottom-sheet, drawer). `null`
   * omite o atributo — o default correto para um botão que não controla nada.
   *
   * Existe porque `app-bottom-nav-bar` precisava anunciar o estado das três
   * superfícies que abre e não tinha como (spec.md FR-016).
   */
  readonly ariaExpanded = input<boolean | null>(null);

  protected readonly variantClass = computed(
    () => `icon-button--${this.kind()} icon-button--${this.appearance()} icon-button--${this.size()}`,
  );

  // 32px (`default`) / 16px (`size="small"`) — ver research.md §4: reusa a prop `size`
  // (número em px) já existente em `ph-icon`, sem mudar a API do wrapper.
  protected readonly iconSizePx = computed(() => (this.size() === 'small' ? 16 : 32));

  // Mesma técnica do Button — ver comentário lá e
  // shared/services/keyboard-focus.service.ts.
  protected readonly keyboardFocused = signal(false);

  private readonly keyboardFocusService = inject(KeyboardFocusService);

  protected onFocus(): void {
    this.keyboardFocused.set(this.keyboardFocusService.isKeyboard());
  }

  protected onBlur(): void {
    this.keyboardFocused.set(false);
  }
}
