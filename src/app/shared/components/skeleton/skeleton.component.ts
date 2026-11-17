import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type SkeletonVariant = 'select' | 'card-patients' | 'card-notify';

/**
 * Placeholder de carregamento com as mesmas dimensões do componente real
 * (`input-select`, `card-patients`, `card-notify`), para a troca por conteúdo
 * não deslocar o layout. Decorativo: o estado ocupado é anunciado pelo
 * contêiner que agrupa os skeletons, não por cada bloco.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-skeleton',
  styleUrl: './skeleton.component.scss',
  template: `<div
    class="skeleton"
    aria-hidden="true"
    [class.skeleton--select]="variant() === 'select'"
    [class.skeleton--card-patients]="variant() === 'card-patients'"
    [class.skeleton--card-notify]="variant() === 'card-notify'"
  ></div>`,
})
export class SkeletonComponent {
  readonly variant = input.required<SkeletonVariant>();
}
