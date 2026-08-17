import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { PhIconComponent } from '../../../../shared/icons/ph-icon/ph-icon.component';

/**
 * Mensagem de erro genérica (FR-013, FR-014) — exibida no lugar do seletor de
 * hospital e da grade de cards quando o carregamento inicial falha e não há
 * dados em cache (Comportamento Offline). Figma node: `4311:8624`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, PhIconComponent],
  selector: 'app-home-error',
  styleUrl: './home-error.component.scss',
  templateUrl: './home-error.component.html',
})
export class HomeErrorComponent {
  readonly retry = output();
}
