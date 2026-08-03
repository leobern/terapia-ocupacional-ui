import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder da tela inicial.
 *
 * NÃO é design: nenhum nó Figma foi implementado aqui, e nenhum valor visual novo
 * é introduzido — só tokens já existentes. O componente existe para que a rota
 * `home` (referenciada por `app.routing.ts` desde o PR #1) aponte para algo real,
 * e para dar ao shell (`app-nav-menu` + `app-bottom-nav-bar`) um conteúdo de rota
 * navegável em teste manual.
 *
 * Substituir pela implementação real via `/speckit-specify` da feature Home.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-home',
  styleUrl: './home.component.scss',
  templateUrl: './home.component.html',
})
export class HomeComponent {}
