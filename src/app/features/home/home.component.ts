import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { HomeHeaderComponent } from './home-header.component';

/** Estado de carregamento da área abaixo do cabeçalho. */
export type HomeLoadState = 'loading' | 'success' | 'error';

/**
 * Tela inicial. O cabeçalho fica fora da alternância de estado (RN-03); o conteúdo
 * de cada estado (skeleton, erro, cards) pertence a outras stories da feature.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomeHeaderComponent],
  selector: 'app-home',
  styleUrl: './home.component.scss',
  templateUrl: './home.component.html',
})
export class HomeComponent {
  readonly loadState = signal<HomeLoadState>('success');
}
