import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

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
  /** Gravações offline pendentes de sincronização neste aparelho (0 = nenhuma). */
  readonly pending = input<number>(0);
  /** Logout em andamento: desabilita Confirmar para impedir envio duplicado. */
  readonly busy = input<boolean>(false);

  readonly confirmed = output();
  readonly cancelled = output();

  /** Texto do aviso: singular e plural concordam com a quantidade pendente. */
  protected readonly pendingText = computed(() => {
    const n = this.pending();
    const subject = n === 1 ? 'Há 1 gravação ainda não enviada' : `Há ${n} gravações ainda não enviadas`;
    const stays =
      n === 1 ? 'ela fica guardada aqui e só será enviada' : 'elas ficam guardadas aqui e só serão enviadas';

    return `${subject} ao servidor neste aparelho. Ao sair, ${stays} quando você entrar de novo com a mesma conta e houver conexão. Prefira esperar a sincronização.`;
  });
  protected readonly i18n = inject(I18nService);
  protected readonly viewport = inject(ViewportBreakpointService);
}
