import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Container de página — replicável em toda tela do projeto (specs "Ajustes
 * de componentes" item 8). Define o max-width por breakpoint:
 *
 *   breakpoint-xs (<672px):  width: 100%, margem de 24px
 *   breakpoint-sm (>=672px): max-width: 640px, centralizado
 *   breakpoint-md (>=1200px): width: 100% (entre menu e side-IA)
 *
 * Também hospeda o elemento decorativo de fundo (item 9) como 1º filho,
 * atrás de todo o conteúdo projetado via `<ng-content>`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-page-container',
  styleUrl: './page-container.component.scss',
  templateUrl: './page-container.component.html',
})
export class PageContainerComponent {}
