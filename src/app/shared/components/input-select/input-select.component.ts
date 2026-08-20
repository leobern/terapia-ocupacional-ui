import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { KeyboardFocusService } from '../../services/keyboard-focus.service';

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
  // Obrigatório (não `''` por default): sem placeholder configurado, o estado
  // Default/unfocused-vazio (ex.: depois de um clear + unfocus) fica em
  // branco em vez de mostrar uma mensagem de instrução — falha de
  // configuração silenciosa que só aparecia em teste manual. Falha em tempo
  // de compilação (Angular template type checking) em vez de runtime, mesmo
  // padrão de `label`/`icon`/`ariaLabel` obrigatórios no Button/IconButton.
  readonly placeholder = input.required<string>();
  readonly iconLeft = input<string | null>(null);
  readonly trailingIcon = input<string | null>(null);
  readonly disabled = input<boolean>(false);

  /**
   * Nome acessível do campo (Princípio X). Opcional porque cai no `placeholder`,
   * que já é obrigatório — nenhuma instância fica anônima.
   *
   * O placeholder VISUAL não serve como nome acessível: além de `placeholder` não
   * ser nome acessível para a maioria das ATs, este componente o apaga ao focar
   * (`displayPlaceholder`), então o campo ficaria sem nome exatamente enquanto
   * está em uso. Promover o texto a `aria-label` resolve os dois casos, e quem
   * precisar de um nome diferente do texto de instrução sobrescreve aqui.
   */
  readonly ariaLabel = input<string>('');

  /**
   * Estado do overlay de opções, para `variant="select"` (Princípio X).
   *
   * O componente NÃO abre o dropdown — ele só emite `selectTrigger` e o overlay é
   * do consumidor (spec.md § Assumptions). Como o `role="combobox"` vive aqui, o
   * contrato do role também vive aqui: quem abre o popup informa `expanded`,
   * o `id` do popup em `controlsId` e a opção ativa em `activeDescendantId`.
   * Sem isso o combobox anunciaria "recolhido" com a listbox aberta.
   */
  readonly expanded = input<boolean>(false);
  readonly controlsId = input<string | null>(null);
  readonly activeDescendantId = input<string | null>(null);

  readonly valueChange = output<string>();
  readonly selectTrigger = output();

  protected readonly focused = signal(false);

  protected readonly hasValue = computed(() => this.value().length > 0);
  protected readonly showClear = computed(() => this.focused() && this.hasValue());
  protected readonly effectiveTrailingIcon = computed(() =>
    this.variant() === 'select' ? 'caret-down' : this.trailingIcon(),
  );

  // Placeholder some ao focar (mesmo antes de digitar) e volta a aparecer só
  // quando o campo perde o foco E continua vazio — decisão do usuário: o
  // placeholder é uma mensagem de instrução, não deve conviver com o cursor
  // de edição para não parecer texto editável.
  protected readonly displayPlaceholder = computed(() => (this.focused() ? '' : this.placeholder()));

  // Nunca vazio: `placeholder` é obrigatório, então há sempre um nome acessível.
  protected readonly effectiveAriaLabel = computed(() => this.ariaLabel() || this.placeholder());

  // Mesma técnica do Button/IconButton — ver
  // shared/services/keyboard-focus.service.ts. Captura a modalidade no
  // momento do foco; o anel rosa só aparece quando esta foi via teclado.
  protected readonly keyboardFocused = signal(false);

  private readonly keyboardFocusService = inject(KeyboardFocusService);

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }

  protected onFocus(): void {
    this.focused.set(true);
    this.keyboardFocused.set(this.keyboardFocusService.isKeyboard());
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.keyboardFocused.set(false);
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
