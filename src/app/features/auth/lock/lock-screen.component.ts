import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { IconLogoComponent } from '../../../shared/components/icon-logo/icon-logo.component';
import { I18nService } from '../../../shared/services/i18n.service';

/**
 * LockScreen (US-001-1-08, RN-03): não exibe nenhum dado clínico. Desenho do agente com
 * componentes existentes do design system (não há frame no Figma).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconLogoComponent],
  selector: 'app-lock-screen',
  styleUrl: './lock-screen.component.scss',
  templateUrl: './lock-screen.component.html',
})
export class LockScreenComponent {
  protected readonly i18n = inject(I18nService);
}
