import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal } from '@angular/core';

/** Largura da ação revelada (Figma "10 · Swipe à esquerda": 110px). */
export const SWIPE_ACTION_WIDTH = 110;
/** Arrasto mínimo (px) para completar o gesto. */
const COMPLETE_THRESHOLD = SWIPE_ACTION_WIDTH / 2;
/** Movimento (px) a partir do qual o toque deixa de ser um clique. */
const DRAG_START = 6;

/**
 * Linha com ação revelada ao arrastar para a esquerda. Só dispara o evento `triggered`: quem usa
 * decide o que fazer (aqui, navegar). A ação também é um botão alcançável por teclado e leitor de tela.
 * Com `startActionLabel`, também suporta o swipe à direita (US-004-1-09) via `startTriggered`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-swipe-row',
  styleUrl: './swipe-row.component.scss',
  templateUrl: './swipe-row.component.html',
})
export class SwipeRowComponent {
  readonly actionLabel = input.required<string>();
  readonly actionAriaLabel = input.required<string>();
  /** Ação do swipe à direita (opcional). Sem rótulo, o gesto à direita não existe. */
  readonly startActionLabel = input('');
  readonly startActionAriaLabel = input('');
  /** Modo somente leitura: sem gesto e sem ação. */
  readonly disabled = input(false);
  readonly triggered = output();
  readonly startTriggered = output();

  protected readonly offset = signal(0);
  protected readonly dragging = signal(false);
  protected readonly focused = signal(false);
  protected readonly startFocused = signal(false);
  protected readonly hasStart = computed(() => this.startActionLabel() !== '');
  protected readonly translate = computed(() => {
    if (this.offset() !== 0) {
      return this.offset();
    }
    if (this.focused()) {
      return -SWIPE_ACTION_WIDTH;
    }

    return this.startFocused() ? SWIPE_ACTION_WIDTH : 0;
  });
  protected readonly revealed = computed(() => this.translate() < 0);
  protected readonly startRevealed = computed(() => this.translate() > 0);

  private moved = false;
  private startX = 0;

  constructor() {
    // Captura: o clique gerado ao soltar o arrasto não pode chegar ao conteúdo (abrir o Hub).
    inject(ElementRef<HTMLElement>).nativeElement.addEventListener(
      'click',
      (e: MouseEvent) => this.swallowClick(e),
      true,
    );
  }

  protected down(event: PointerEvent): void {
    if (this.disabled()) {
      return;
    }
    this.startX = event.clientX;
    this.moved = false;
    this.dragging.set(true);
  }

  protected move(event: PointerEvent): void {
    if (!this.dragging()) {
      return;
    }
    const max = this.hasStart() ? SWIPE_ACTION_WIDTH : 0;
    const dx = Math.min(max, Math.max(-SWIPE_ACTION_WIDTH, event.clientX - this.startX));

    if (Math.abs(dx) > DRAG_START) {
      this.moved = true;
    }
    this.offset.set(dx);
  }

  protected up(): void {
    if (!this.dragging()) {
      return;
    }
    const offset = this.offset();

    this.dragging.set(false);
    this.offset.set(0);
    if (-offset >= COMPLETE_THRESHOLD) {
      this.triggered.emit();
    } else if (offset >= COMPLETE_THRESHOLD) {
      this.startTriggered.emit();
    }
  }

  /** Depois de arrastar, o clique que o navegador gera ao soltar não pode abrir o Hub. */
  protected swallowClick(event: MouseEvent): void {
    if (this.moved) {
      event.stopPropagation();
      event.preventDefault();
      this.moved = false;
    }
  }
}
