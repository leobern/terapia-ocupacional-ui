import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BottomNavBarComponent } from './shared/components/bottom-nav-bar/bottom-nav-bar.component';
import { NavMenuComponent } from './shared/components/nav-menu/nav-menu.component';

/**
 * Shell da aplicação: hospeda o par simétrico de navegação — `app-nav-menu`
 * (trilho lateral, só em `md`) e `app-bottom-nav-bar` (barra inferior, só em
 * `xs`/`sm`). As duas são instância ÚNICA aqui; nenhuma tela as monta.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomNavBarComponent, NavMenuComponent, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html',
})
export class AppComponent {}
