import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

/**
 * Estado de carregamento inicial (FR-018) — ocupa o mesmo espaço final do
 * seletor de hospital + grade de cards, para não deslocar o layout quando os
 * dados chegarem. Reaproveita `p-skeleton` do PrimeNG (research.md §6) em vez
 * de recriar a animação de shimmer do zero. Figma node: `4023:2230`.
 *
 * Nesta versão 17.x do PrimeNG o Skeleton ainda é distribuído como
 * `SkeletonModule` (NgModule), não como componente standalone.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonModule],
  selector: 'app-home-skeleton',
  styleUrl: './home-skeleton.component.scss',
  templateUrl: './home-skeleton.component.html',
})
export class HomeSkeletonComponent {
  protected readonly placeholderCards = [0, 1, 2, 3];
}
