import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { type IconLogoState, IconLogoVisualComponent } from './icon-logo-visual.component';

export type { IconLogoState };

/**
 * Símbolo da IA do Conductia em uso **decorativo** (DS-component-icon-logo).
 *
 * Sempre `aria-hidden` e nunca focável: é marca/ilustração ou indicador de estado, não um
 * controle. Para o símbolo clicável use `app-icon-logo-button` — a separação em dois
 * componentes existe para que o `aria-label` do botão seja obrigatório em tempo de
 * compilação, tornando um controle sem nome acessível (WCAG 4.1.2) não representável no
 * código (spec.md § Clarifications, 2026-07-26).
 *
 * Tamanho via a custom property CSS `--icon-logo-size` (default `48px`), que descreve o
 * **círculo visível**. A caixa ocupada no layout é `1.75×` esse valor, porque já inclui o
 * transbordamento das luzes e do halo — ver contracts/icon-logo.api.md.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  imports: [IconLogoVisualComponent],
  selector: 'app-icon-logo',
  styleUrl: './icon-logo.component.scss',
  templateUrl: './icon-logo.component.html',
})
export class IconLogoComponent {
  readonly state = input<IconLogoState>('default');
}
