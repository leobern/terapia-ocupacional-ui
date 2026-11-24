import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PhIconComponent } from '../../shared/icons/ph-icon/ph-icon.component';
import { I18nService } from '../../shared/services/i18n.service';

/**
 * Configurações do app. Por ora só "Rever tutorial" (US-001-3-02, RN03);
 * novas opções entram com as stories que as pedirem.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageContainerComponent, PhIconComponent],
  selector: 'app-settings',
  styleUrl: './settings.component.scss',
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected reviewTutorial(): void {
    void this.router.navigateByUrl('/settings/tutorial');
  }
}
