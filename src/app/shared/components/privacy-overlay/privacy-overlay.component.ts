import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { PrivacyOverlayService } from '../../services/privacy-overlay.service';
import { IconLogoComponent } from '../icon-logo/icon-logo.component';

/**
 * PrivacyOverlay (US-001-1-08, RN-03): camada opaca sobre todo o app enquanto ele está em
 * segundo plano ou sem foco, para o seletor de apps do SO não mostrar dados clínicos.
 * Só o logo, nenhum dado; usa as cores do tema ativo (claro/escuro).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconLogoComponent],
  selector: 'app-privacy-overlay',
  styleUrl: './privacy-overlay.component.scss',
  template: `
    @if (overlay.visible()) {
      <div class="privacy-overlay" data-testid="privacy-overlay" aria-hidden="true">
        <app-icon-logo state="default" />
      </div>
    }
  `,
})
export class PrivacyOverlayComponent {
  protected readonly overlay = inject(PrivacyOverlayService);
}
