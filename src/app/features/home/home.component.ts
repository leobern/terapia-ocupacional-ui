import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { InputSelectComponent } from '../../shared/components/input-select/input-select.component';
import { HomeHeaderComponent } from './home-header.component';
import { HomeSkeletonComponent } from './home-skeleton.component';
import { type HomeLoadStatus, HomeStateService } from './home-state.service';
import { HospitalContextService } from './hospital-context.service';
import { UnreadNotificationsReader } from './unread-notifications-reader';

/** Estado de carregamento da área abaixo do cabeçalho. */
export type HomeLoadState = HomeLoadStatus;

/**
 * Tela inicial. O cabeçalho fica fora da alternância de estado (RN-03); o conteúdo
 * de cada estado (skeleton, erro, cards) pertence a outras stories da feature.
 * Hospeda o sino de notificações (US-003-1-02) e o seletor de hospital (US-003-1-03),
 * que alimenta `HospitalContextService`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, HomeHeaderComponent, HomeSkeletonComponent, IconButtonComponent, InputSelectComponent],
  selector: 'app-home',
  styleUrl: './home.component.scss',
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  protected readonly state = inject(HomeStateService);
  /** Estado de carregamento inicial, compartilhado com as stories irmãs via `HomeStateService`. */
  readonly loadState = this.state.status;
  protected readonly unreadCount = signal(0);

  private readonly router = inject(Router);
  private readonly reader = inject(UnreadNotificationsReader);

  async ngOnInit(): Promise<void> {
    this.unreadCount.set(await this.reader.countUnread());
  }

  protected bellLabel(): string {
    const count = this.unreadCount();

    return count > 0 ? `Notificações, ${count} não lidas` : 'Notificações';
  }

  protected openNotifications(): void {
    void this.router.navigateByUrl('/notificacoes');
  }

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
