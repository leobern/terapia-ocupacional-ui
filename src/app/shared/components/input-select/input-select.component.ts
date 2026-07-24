import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';

/**
 * Determina o elemento semântico interno (specs/ds/DS-component-input-select/spec.md):
 * `text` renderiza um `<input>` nativo editável; `select` renderiza um trigger não
 * editável (`role="combobox"`) que só notifica a intenção de abrir um overlay externo.
 */
export type InputSelectVariant = 'text' | 'select';

/**
 * Campo de entrada de texto ou seleção de design system (DS-component-input-select).
 * `variant="select"` nunca aceita digitação nem abre o overlay por conta própria — ele
 * só emite `selectTrigger`, deixando a implementação do dropdown/bottom-sheet para o
 * consumidor (spec.md § Assumptions, dependência externa).
 *
 * O ícone de limpar é um estado derivado (`showClear`), nunca uma prop — visível apenas
 * quando o componente está focado e `value` não está vazio (spec.md § Anatomia).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhIconComponent],
  selector: 'app-input-select',
  styleUrl: './input-select.component.scss',
  templateUrl: './input-select.component.html',
})
export class InputSelectComponent {
  readonly variant = input<InputSelectVariant>('text');
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  readonly iconLeft = input<string | null>(null);
  readonly trailingIcon = input<string | null>(null);
  readonly disabled = input<boolean>(false);

  readonly valueChange = output<string>();
  readonly selectTrigger = output();

  protected readonly focused = signal(false);

  protected readonly hasValue = computed(() => this.value().length > 0);
  protected readonly showClear = computed(() => this.focused() && this.hasValue());
  protected readonly effectiveTrailingIcon = computed(() =>
    this.variant() === 'select' ? 'caret-down' : this.trailingIcon(),
  );

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }

  protected onFocus(): void {
    this.focused.set(true);
  }

  protected onBlur(): void {
    this.focused.set(false);
  }

  protected onSelectClick(): void {
    if (this.disabled()) {
      return;
    }

    this.selectTrigger.emit();
  }

  // `(keydown.enter)`/`(keydown.space)` tipam `$event` como `Event` (não
  // `KeyboardEvent`) no template checker do Angular — só `preventDefault()`
  // é usado aqui, disponível em `Event`, então o tipo mais amplo é o correto.
  protected onSelectKeydown(event: Event): void {
    if (this.disabled()) {
      return;
    }

    event.preventDefault();
    this.selectTrigger.emit();
  }

  // `mousedown` (não `click`) para o `<button>` de limpar nunca roubar o foco do campo —
  // sem isso, o clique no botão dispara blur antes do handler de click rodar, escondendo
  // o próprio botão (showClear depende de `focused`) antes de `onClear` ser chamado.
  protected onClearMousedown(event: MouseEvent): void {
    event.preventDefault();
  }

  protected onClear(): void {
    this.valueChange.emit('');
  }
}
