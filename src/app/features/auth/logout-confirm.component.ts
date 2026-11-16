import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { BottomSheetComponent } from '../../shared/components/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { DrawerComponent } from '../../shared/components/drawer/drawer.component';
import { I18nService } from '../../shared/services/i18n.service';
import { ViewportBreakpointService } from '../../shared/services/viewport-breakpoint.service';

/**
 * Confirmação de logout (RN01), montada só com superfícies do design system:
 * `app-bottom-sheet` em celular/tablet e `app-drawer` em desktop (cada um se
 * esconde fora do seu breakpoint). Controlado pelo consumidor: não encerra
 * sessão nem navega — só emite `confirmed` ou `cancelled`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, ButtonComponent, DrawerComponent, NgTemplateOutlet],
  selector: 'app-logout-confirm',
  styleUrl: './logout-confirm.component.scss',
  templateUrl: './logout-confirm.component.html',
})
export class LogoutConfirmComponent {
  readonly open = input<boolean>(false);

  readonly confirmed = output();
  readonly cancelled = output();

  protected readonly i18n = inject(I18nService);
  protected readonly viewport = inject(ViewportBreakpointService);
}
