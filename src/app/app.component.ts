import { ChangeDetectionStrategy, Component, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { BottomNavBarComponent } from './shared/components/bottom-nav-bar/bottom-nav-bar.component';
import { NavMenuComponent } from './shared/components/nav-menu/nav-menu.component';

/**
 * Shell da aplicação: hospeda o par simétrico de navegação — `app-nav-menu`
 * (trilho lateral, só em `md`) e `app-bottom-nav-bar` (barra inferior, só em
 * `xs`/`sm`). As duas são instância ÚNICA aqui; nenhuma tela as monta.
 * Rotas com `data.hideShell` (ex.: splash) ocultam a navegação.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomNavBarComponent, NavMenuComponent, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html',
})
export class AppComponent {
  protected readonly showShell: Signal<boolean>;

  constructor() {
    const router = inject(Router);

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
}
