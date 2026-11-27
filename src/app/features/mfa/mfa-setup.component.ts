import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthShellComponent } from '../../shared/components/auth-shell/auth-shell.component';
import { BannerComponent } from '../../shared/components/banner/banner.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { I18nService } from '../../shared/services/i18n.service';
import { ViewportBreakpointService } from '../../shared/services/viewport-breakpoint.service';
import { LocalSessionStore, SessionTokens } from '../auth/local-session-store';
import { safeReturnUrl } from '../auth/return-url';
import { MfaChallengeStore, MfaGateway, MfaResult, MfaSetup } from './mfa-gateway';

export type MfaSetupStep = 'SCAN' | 'CODES';

/**
 * Ativação do MFA no primeiro acesso (Figma seção 12, telas 13 e 14): cadastra o app autenticador, confirma com o
 * primeiro código e mostra os códigos de recuperação (cada um vale uma vez). A sessão só abre depois de a pessoa
 * confirmar que guardou os códigos.
 *
 * O QR code ainda não é desenhado (falta decidir a biblioteca): enquanto isso a tela mostra a chave em texto e o
 * link `otpauth://`, que o app autenticador abre no celular.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthShellComponent, BannerComponent, ButtonComponent],
  selector: 'app-mfa-setup',
  templateUrl: './mfa-setup.component.html',
})
export class MfaSetupComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  protected readonly step = signal<MfaSetupStep>('SCAN');
  protected readonly setup = signal<MfaSetup | null>(null);
  protected readonly setupFailed = signal(false);
  protected readonly code = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<'invalid-code' | 'locked' | 'expired' | 'network-error' | 'required' | null>(null);
  protected readonly recoveryCodes = signal<readonly string[]>([]);
  protected readonly copied = signal(false);
  protected readonly isDesktop = inject(ViewportBreakpointService).isDesktop;
  /** Chave em grupos de 4 caracteres, mais fácil de digitar no app. */
  protected readonly secretGroups = computed(() => (this.setup()?.secret ?? '').replace(/(.{4})/g, '$1 ').trim());
  protected readonly fieldError = computed(() => {
    const error = this.error();

    return error === 'invalid-code' || error === 'required' ? this.i18n.t(`mfa.error.${error}`) : '';
  });
  protected readonly bannerMessage = computed(() => {
    const error = this.error();

    return error === 'locked' || error === 'expired' || error === 'network-error'
      ? this.i18n.t(`mfa.error.${error}`)
      : '';
  });

  private pendingTokens: SessionTokens | null = null;
  private readonly gateway = inject(MfaGateway);
  private readonly challenge = inject(MfaChallengeStore);
  private readonly session = inject(LocalSessionStore);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const challenge = this.challenge.current();

    if (challenge === null) {
      void this.router.navigateByUrl('/login', { replaceUrl: true });

      return;
    }
    void this.gateway.beginSetup(challenge.token).then(setup => {
      this.setup.set(setup);
      this.setupFailed.set(setup === null);
    });
  }

  protected onCode(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value);
  }

  protected leave(): void {
    this.challenge.current.set(null);
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  protected activate(event?: Event): void {
    event?.preventDefault();
    const challenge = this.challenge.current();
    const code = this.code().trim();

    if (this.loading() || challenge === null) {
      return;
    }
    if (code === '') {
      this.error.set('required');

      return;
    }
    this.error.set(null);
    this.loading.set(true);
    void this.gateway.confirmSetup(challenge.token, code).then(result => {
      this.loading.set(false);
      this.handle(result);
    });
  }

  protected async copyCodes(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.recoveryCodes().join('\n'));
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  protected finish(): void {
    if (this.pendingTokens === null) {
      return;
    }
    this.challenge.current.set(null);
    this.session.open(this.pendingTokens);
    this.pendingTokens = null;
    void this.router.navigate(['/splash'], { queryParams: { returnUrl: safeReturnUrl(null) }, replaceUrl: true });
  }

  private handle(result: MfaResult): void {
    if (result.kind !== 'success') {
      this.error.set(result.kind);

      return;
    }
    this.pendingTokens = result.tokens;
    this.recoveryCodes.set(result.recoveryCodes ?? []);
    this.step.set('CODES');
  }
}
