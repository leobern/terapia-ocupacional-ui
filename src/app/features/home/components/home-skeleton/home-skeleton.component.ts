import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Estado de carregamento inicial (FR-018) — ocupa o mesmo espaço final do
 * seletor de hospital + grade de cards, para não deslocar o layout quando os
 * dados chegarem. Blocos próprios (mesmas medidas do desenho) com o pulso do
 * skeleton do design system: o `p-skeleton` do PrimeNG 17 não renderiza no
 * Angular 21 (erro de template em runtime). Figma node: `4023:2230`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-home-skeleton',
  styleUrl: './home-skeleton.component.scss',
  templateUrl: './home-skeleton.component.html',
})
export class HomeSkeletonComponent {
  protected readonly placeholderCards = [0, 1, 2, 3];
}
