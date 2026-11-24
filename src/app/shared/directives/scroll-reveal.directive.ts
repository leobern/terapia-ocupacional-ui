import { DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * Barra de rolagem que só aparece enquanto se rola (Thiago, 2026-11-24): marca o elemento com
 * `data-scrolling="true"` a cada evento de rolagem e tira a marca depois de `hideAfterMs` sem rolar. O CSS do
 * consumidor mostra o polegar da barra só nesse estado (`[data-scrolling='true']::-webkit-scrollbar-thumb`).
 */
@Directive({
  host: { '(scroll)': 'onScroll()' },
  selector: '[appScrollReveal]',
})
export class ScrollRevealDirective {
  /** Quanto tempo a barra fica visível depois da última rolagem. */
  readonly hideAfterMs = input(900);

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onScroll(): void {
    this.element.dataset['scrolling'] = 'true';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => delete this.element.dataset['scrolling'], this.hideAfterMs());
  }
}
