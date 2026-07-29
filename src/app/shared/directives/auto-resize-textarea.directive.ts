import { afterRenderEffect, Directive, ElementRef, HostListener, inject, input } from '@angular/core';

/**
 * Faz um `<textarea>` acompanhar a altura do próprio conteúdo.
 *
 * O reset para `auto` antes de ler `scrollHeight` é obrigatório, não uma
 * precaução: `scrollHeight` nunca encolhe abaixo da altura já aplicada ao
 * elemento, então sem o reset o campo só cresceria — apagar linhas não o
 * devolveria ao tamanho anterior.
 *
 * A diretiva NÃO conhece o teto de crescimento de propósito. O `max-height`
 * vive no CSS do ancestral rolável, no mesmo lugar onde `overflow-y: auto`
 * está declarado (DS-component-input-chat FR-001/FR-002) — um único valor, um
 * único lugar. Quando o conteúdo passa do teto, o navegador assume a rolagem
 * sozinho, sem a diretiva precisar saber disso.
 */
@Directive({
  selector: 'textarea[appAutoResizeTextarea]',
})
export class AutoResizeTextareaDirective {
  /**
   * Valor atual do campo. Ouvir só o evento `input` não basta: quando o
   * componente hospedeiro limpa o valor programaticamente (ao enviar a
   * mensagem, por exemplo), nenhum `input` é disparado e o campo ficaria
   * travado na altura do texto antigo — uma caixa enorme e vazia depois de
   * enviar uma mensagem longa. Bug encontrado em verificação no navegador.
   */
  readonly value = input<string>('', { alias: 'appAutoResizeTextarea' });

  private readonly host = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);

  constructor() {
    // `afterRenderEffect` (não `effect`): a altura precisa ser medida DEPOIS de
    // o binding `[value]` ter atualizado o DOM, senão `scrollHeight` ainda
    // reflete o texto anterior.
    afterRenderEffect(() => {
      this.value();
      this.resize();
    });
  }

  @HostListener('input')
  protected onInput(): void {
    this.resize();
  }

  /**
   * Público além do uso interno: permite ao hospedeiro forçar um reajuste em
   * cenários que não passam nem por `input` nem por mudança de `value`.
   */
  resize(): void {
    const el = this.host.nativeElement;

    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
}
