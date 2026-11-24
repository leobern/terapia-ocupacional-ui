import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconLogoComponent } from '../../shared/components/icon-logo/icon-logo.component';
import { I18nService } from '../../shared/services/i18n.service';
import { TutorialStateStore } from '../tutorial/tutorial-state';
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

  private async navigate(attempt: number): Promise<void> {
    const state = this.reader.readLocal();
    // Só consulta o tutorial quando o acesso já levaria ao Painel; falha na leitura não bloqueia o médico.
    const tutorialPending =
      decideDestination(state) === '/home' && (await this.tutorial.read().catch(() => 'CONCLUIDO')) === 'PENDENTE';

    if (attempt === this.attempt) {
      await this.router.navigateByUrl(decideDestination(state, tutorialPending), { replaceUrl: true });
    }
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
