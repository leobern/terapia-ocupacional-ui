import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconLogoComponent } from '../../shared/components/icon-logo/icon-logo.component';
import { I18nService } from '../../shared/services/i18n.service';
import { TutorialStateStore } from '../tutorial/tutorial-state';
import { WelcomeSource } from '../welcome/welcome-source';
import { decideDestination } from './splash-destination';
import { StartupStateReader } from './startup-state';

export type SplashState = 'INITIALIZING' | 'ERROR_NO_CONNECTION';

/** RN-01: tempo mínimo de exibição. */
export const SPLASH_MIN_DISPLAY_MS = 2000;
/** RN-02: tempo máximo de inicialização. */
export const SPLASH_TIMEOUT_MS = 30000;

/**
 * Splashscreen (US-001-1-01). `splash_animation` ainda não existe no repositório:
 * o `app-icon-logo` em `state="anim"` (loop) é o placeholder com a mesma função.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconLogoComponent],
  selector: 'app-splash',
  styleUrl: './splash.component.scss',
  templateUrl: './splash.component.html',
})
export class SplashComponent implements OnInit {
  protected readonly state = signal<SplashState>('INITIALIZING');
  protected readonly i18n = inject(I18nService);

  private readonly reader = inject(StartupStateReader);
  private readonly tutorial = inject(TutorialStateStore);
  private readonly router = inject(Router);
  private readonly welcome = inject(WelcomeSource);
  private attempt = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.attempt++;
      this.clearTimers();
    });
  }

  ngOnInit(): void {
    this.start();
  }

  protected retry(): void {
    this.state.set('INITIALIZING');
    this.start();
  }

  private start(): void {
    this.clearTimers();
    const attempt = ++this.attempt;
    const isCurrent = (): boolean => attempt === this.attempt;
    let minElapsed = false;
    let ready = false;

    const tryNavigate = (): void => {
      if (isCurrent() && minElapsed && ready) {
        this.clearTimers();
        void this.navigate(attempt);
      }
    };

    this.timers.push(
      setTimeout(() => {
        minElapsed = true;
        tryNavigate();
      }, SPLASH_MIN_DISPLAY_MS),
      setTimeout(() => {
        if (isCurrent() && !ready) {
          this.fail();
        }
      }, SPLASH_TIMEOUT_MS),
    );

    this.reader.initialize().then(
      () => {
        ready = true;
        tryNavigate();
      },
      () => {
        if (!isCurrent()) {
          return;
        }
        // RN-04: com sessão local válida o roteamento segue com dados locais.
        if (this.reader.readLocal().isSessionValid) {
          ready = true;
          tryNavigate();
        } else {
          this.fail();
        }
      },
    );
  }

  /**
   * Resolve o destino. Com destino `/home`, as boas-vindas ainda não vistas (US-001-3-01) têm
   * prioridade; depois, o tutorial pendente (US-001-3-02). Falha em qualquer leitura nunca
   * bloqueia o médico: segue ao Painel.
   */
  private async navigate(attempt: number): Promise<void> {
    const state = this.reader.readLocal();
    let destination: string = decideDestination(state);

    if (destination === '/home') {
      if (await this.welcomePending()) {
        destination = '/welcome';
      } else if (await this.tutorialPending()) {
        destination = decideDestination(state, true);
      }
    }
    if (attempt === this.attempt) {
      await this.router.navigateByUrl(destination, { replaceUrl: true });
    }
  }

  private welcomePending(): Promise<boolean> {
    return this.welcome.getStatus().then(
      status => status.shouldShow,
      () => false,
    );
  }

  private tutorialPending(): Promise<boolean> {
    return this.tutorial.read().then(
      status => status === 'PENDENTE',
      () => false,
    );
  }

  private fail(): void {
    this.attempt++;
    this.clearTimers();
    this.state.set('ERROR_NO_CONNECTION');
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
