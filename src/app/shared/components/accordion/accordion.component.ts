import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';

/** Mapeia o estado visual do accordion (specs/ds/DS-component-accordion/spec.md). */
export type AccordionState = 'collapsed-empty' | 'expanded' | 'collapsed-filled';

/**
 * Mapeia a propriedade Figma `viewType` — só relevante quando `state='collapsed-filled'`.
 * Não gera nenhuma classe/estilo própria neste componente (ver comentário em
 * `accordion.component.html`): existe na API para documentar a intenção semântica de cada
 * instância e para consumidores futuros que precisem diferenciar por tipo de resposta.
 */
export type AccordionViewType = 'tag' | 'texto' | 'data';

/**
 * Accordion de "pergunta única" reutilizável (DS-component-accordion) — chassi opaco:
 * nunca conhece o valor respondido, nunca decide sozinho o próximo `state`. Quem consome
 * controla `state` via input e decide, ao fechar, se o próximo estado é
 * `collapsed-empty` (sem valor) ou `collapsed-filled` (com valor) — o accordion só emite
 * `toggled` (research.md §4).
 *
 * O header inteiro (título + ícone) é um único `<button>` nativo — a Figma mostra um ícone
 * circular decorativo dentro da linha, mas reaproveitar `app-icon-button` aqui aninharia um
 * `<button>` dentro de outro (o header inteiro precisa ser clicável, spec.md § Acessibilidade/
 * SC-004), o que é HTML inválido e confunde leitores de tela. O ícone é desenhado com
 * `ph-icon` puro, decorativo (`aria-hidden`), dentro do único botão real.
 *
 * Os dois slots projetados ficam sempre no DOM (nunca por trás de `@if`) para permitir a
 * transição de altura de 200ms de spec.md § Interações & Motion via CSS puro
 * (`grid-template-rows: 0fr/1fr`, sem `@angular/animations` — mesma filosofia sem lib de
 * animação do `bottom-sheet`/`drawer`); `[attr.inert]` no `.html` neutraliza foco/interação
 * no slot fechado, já que ele não é removido do DOM.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhIconComponent],
  selector: 'app-accordion',
  styleUrl: './accordion.component.scss',
  templateUrl: './accordion.component.html',
})
export class AccordionComponent {
  readonly title = input.required<string>();
  readonly state = input.required<AccordionState>();
  readonly viewType = input<AccordionViewType | null>(null);
  readonly emptyPlaceholder = input<string>('Aguardando resposta');

  /** Emitido a cada clique/toque no header, ou Enter/Espaço com foco nele (via <button> nativo). */
  readonly toggled = output();

  protected readonly isExpanded = computed(() => this.state() === 'expanded');
  protected readonly isEmpty = computed(() => this.state() === 'collapsed-empty');
  protected readonly isFilled = computed(() => this.state() === 'collapsed-filled');

  protected onToggle(): void {
    this.toggled.emit();
  }
}
