import { Directive, ElementRef, inject, input, output } from '@angular/core';

/**
 * Padrão de todo dropdown/lista flutuante (Thiago, 2026-11-27): um clique fora dela fecha. Coloque a diretiva na
 * própria lista (que só existe aberta) e feche-a em `(appClickOutside)`. O botão que abre a lista fica de fora da
 * regra via `appClickOutsideIgnore` (seletor CSS), senão o clique nele fecharia e o próprio botão reabriria.
 */
@Directive({
  host: { '(document:click)': 'onDocumentClick($event)' },
  selector: '[appClickOutside]',
})
export class ClickOutsideDirective {
  /** Seletor CSS dos elementos (ex.: o botão que abre a lista) cujo clique não conta como "fora". */
  readonly appClickOutsideIgnore = input<string | null>(null);
  readonly appClickOutside = output();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected onDocumentClick(event: Event): void {
    const target = event.target;

    // O caminho do evento vale no instante do clique: o alvo pode já ter saído do DOM (re-renderização do item).
    if (!(target instanceof Element) || event.composedPath().includes(this.element)) {
      return;
    }

    const ignore = this.appClickOutsideIgnore();

    if (ignore !== null && target.closest(ignore) !== null) {
      return;
    }

    this.appClickOutside.emit();
  }
}
