import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconButtonComponent } from '../icon-button/icon-button.component';

/**
 * Título de seção (Figma v2/SectionHeader): título 20 Semi Bold com padding lateral de 8px e, opcionalmente,
 * o botão tonal de edição (lápis) à direita. Os cards da seção vêm logo abaixo, a 8px.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent],
  selector: 'app-section-header',
  styleUrl: './section-header.component.scss',
  templateUrl: './section-header.component.html',
})
export class SectionHeaderComponent {
  readonly title = input.required<string>();
  /** Nome do ícone da ação à direita; sem valor, o título aparece sozinho. */
  readonly actionIcon = input<string | null>(null);
  readonly actionLabel = input<string>('Editar');
  readonly actionDisabled = input<boolean>(false);
  readonly headingId = input<string | null>(null);

  readonly actionClick = output();
}
