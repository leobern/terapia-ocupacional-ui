import { ChangeDetectionStrategy, Component, effect, type ElementRef, input, output, viewChild } from '@angular/core';

import { ButtonComponent } from '../button/button.component';

/**
 * Diálogo de confirmação de descarte de rascunho (FR-010a/FR-004b de
 * specs/004-notificacoes). Sem nó Figma de origem — nasceu de
 * `/speckit-clarify` (2026-08-17), não do fluxo analisado no Figma; desvio
 * documentado em plan.md § Constitution Check e research.md §7. Construído só
 * com tokens já catalogados (cor/tipografia/spacing/radius), reaproveitando
 * `app-button` para as duas ações.
 *
 * Compartilhado desde a US-004-1-03 (segundo consumidor: troca para data retroativa).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'alertdialog', '[attr.aria-hidden]': '!open()', '(document:keydown.escape)': 'onEscape()' },
  imports: [ButtonComponent],
  selector: 'app-confirm-dialog',
  styleUrl: './confirm-dialog.component.scss',
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  readonly open = input.required<boolean>();
  // Textos do Figma v2/Dialog Type=confirm.
  readonly title = input<string>('Descartar resposta?');
  readonly message = input<string>('O texto que você escreveu será perdido.');
  readonly confirmLabel = input<string>('Descartar');
  readonly cancelLabel = input<string>('Continuar editando');

  readonly confirmed = output();
  readonly cancelled = output();

  private readonly scrim = viewChild<ElementRef<HTMLElement>>('scrim');

  constructor() {
    // Vai para a camada superior do navegador (popover): fica acima de tudo, mesmo aberto de dentro do sidebar.
    effect(() => {
      const element = this.scrim()?.nativeElement;

      if (element !== undefined && !element.matches(':popover-open')) {
        element.showPopover();
      }
    });
  }

  protected onEscape(): void {
    if (this.open()) {
      this.cancelled.emit();
    }
  }
}
