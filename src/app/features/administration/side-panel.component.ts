import { ChangeDetectionStrategy, Component, effect, ElementRef, input, output, viewChild } from '@angular/core';

import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';

/**
 * Painel de cadastro da Administração: sidebar à direita no desktop e bottom sheet no mobile (borda azul de 4px
 * só à esquerda no desktop, Figma `4775:27420`). Cabeçalho com título e fechar; o corpo e o rodapé (ações) vêm
 * por projeção (`[panelBody]` e `[panelFooter]`). Sem IA na v1: formulários manuais.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  imports: [IconButtonComponent],
  selector: 'app-side-panel',
  styleUrl: './side-panel.component.scss',
  templateUrl: './side-panel.component.html',
})
export class SidePanelComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly closed = output();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    effect(() => {
      if (this.open()) {
        queueMicrotask(() => this.panel()?.nativeElement.focus());
      }
    });
  }

  protected onEscape(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }
}
