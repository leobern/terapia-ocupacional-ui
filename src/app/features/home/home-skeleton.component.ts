import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

/** Quantidade de cards de notificação no skeleton (card de contagem + 5 = 3 linhas). */
const NOTIFY_PLACEHOLDERS = [1, 2, 3, 4, 5];

/**
 * Skeleton do seletor de hospital e da grade de cards da Home (RN-01/RN-02):
 * grade de duas colunas, com o card de contagem na primeira posição.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  selector: 'app-home-skeleton',
  styleUrl: './home-skeleton.component.scss',
  template: `
    <div class="home-skeleton" role="status" aria-busy="true" aria-label="Carregando dados">
      <app-skeleton variant="select" />
      <div class="home-skeleton__grid">
        <app-skeleton variant="card-patients" />
        @for (item of placeholders; track item) {
          <app-skeleton variant="card-notify" />
        }
      </div>
    </div>
  `,
})
export class HomeSkeletonComponent {
  protected readonly placeholders = NOTIFY_PLACEHOLDERS;
}
