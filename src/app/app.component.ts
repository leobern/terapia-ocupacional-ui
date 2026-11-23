import { ChangeDetectionStrategy, Component, inject, Signal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { LogoutService } from './features/auth/logout.service';
import { LogoutConfirmComponent } from './features/auth/logout-confirm.component';
import { BottomNavBarComponent } from './shared/components/bottom-nav-bar/bottom-nav-bar.component';
import { BottomSheetComponent } from './shared/components/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from './shared/components/button/button.component';
import { NavMenuComponent } from './shared/components/nav-menu/nav-menu.component';
import { I18nService } from './shared/services/i18n.service';

/**
 * Shell da aplicação: hospeda o par simétrico de navegação — `app-nav-menu`
 * (trilho lateral, só em `md`) e `app-bottom-nav-bar` (barra inferior, só em
 * `xs`/`sm`). As duas são instância ÚNICA aqui; nenhuma tela as monta.
 * Rotas com `data.hideShell` (ex.: splash) ocultam a navegação.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BottomNavBarComponent,
    BottomSheetComponent,
    ButtonComponent,
    LogoutConfirmComponent,
    NavMenuComponent,
    RouterOutlet,
  ],
  selector: 'app-root',
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html',
})
export class AppComponent {
  protected readonly showShell: Signal<boolean>;
  protected readonly i18n = inject(I18nService);
  /** Menu do celular/tablet (a barra inferior abre este sheet; em desktop o rail tem "Sair"). */
  protected readonly menuOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  /** Trava reentrância: duplo clique em Confirmar não pode chamar `logout()` duas vezes. */
  protected readonly loggingOut = signal(false);

  private readonly router = inject(Router);
  private readonly logoutService = inject(LogoutService);

  constructor() {
    const router = this.router;

    this.showShell = toSignal(
      router.events.pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => {
          let route = router.routerState.snapshot.root;

          while (route.firstChild) {
            route = route.firstChild;
          }

          return route.data['hideShell'] !== true;
        }),
      ),
      { initialValue: !router.url.startsWith('/splash') && router.url !== '/' },
    );
  }

  protected requestLogout(): void {
    this.menuOpen.set(false);
    this.confirmOpen.set(true);
  }

  protected cancelLogout(): void {
    this.confirmOpen.set(false);
  }

  protected async confirmLogout(): Promise<void> {
    if (this.loggingOut()) {
      return;
    }

    this.loggingOut.set(true);

    try {
      await this.logoutService.logout();
    } finally {
      this.loggingOut.set(false);
    }

    this.confirmOpen.set(false);
    // replaceUrl: a rota autenticada atual sai do histórico.
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
