import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { InputSelectComponent } from '../../shared/components/input-select/input-select.component';
import { HomeHeaderComponent } from './home-header.component';
import { HospitalContextService } from './hospital-context.service';

/** Estado de carregamento da área abaixo do cabeçalho. */
export type HomeLoadState = 'loading' | 'success' | 'error';

/**
 * Tela inicial. O cabeçalho fica fora da alternância de estado (RN-03); o conteúdo
 * de cada estado (skeleton, erro, cards) pertence a outras stories da feature.
 * O seletor de hospital (US-003-1-03) alimenta `HospitalContextService`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HomeHeaderComponent, InputSelectComponent],
  selector: 'app-home',
  styleUrl: './home.component.scss',
  templateUrl: './home.component.html',
})
export class HomeComponent {
  readonly loadState = signal<HomeLoadState>('success');

  protected readonly context = inject(HospitalContextService);
  protected readonly listOpen = signal(false);
  protected readonly listId = 'home-hospital-list';

  protected onTrigger(): void {
    if (this.context.canSwitch) {
      this.listOpen.update(open => !open);
    }
  }

  protected choose(id: string): void {
    this.context.select(id);
    this.listOpen.set(false);
  }

  protected onOptionKeydown(event: Event, index: number, id: string): void {
    const key = (event as KeyboardEvent).key;
    const options = (event.currentTarget as HTMLElement).parentElement?.children;

    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      this.choose(id);
    } else if (key === 'Escape') {
      this.listOpen.set(false);
    } else if ((key === 'ArrowDown' || key === 'ArrowUp') && options) {
      event.preventDefault();
      const next = key === 'ArrowDown' ? index + 1 : index - 1;

      (options[(next + options.length) % options.length] as HTMLElement).focus();
    }
  }
}
