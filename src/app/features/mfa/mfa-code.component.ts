import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthShellComponent } from '../../shared/components/auth-shell/auth-shell.component';
import { BannerComponent } from '../../shared/components/banner/banner.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { I18nService } from '../../shared/services/i18n.service';
import { ViewportBreakpointService } from '../../shared/services/viewport-breakpoint.service';
import { LocalSessionStore } from '../auth/local-session-store';
import { safeReturnUrl } from '../auth/return-url';
import { MfaChallengeStore, MfaGateway, MfaResult } from './mfa-gateway';

type MfaCodeError = 'invalid-code' | 'locked' | 'expired' | 'network-error' | 'required';

/**
 * Verificação em duas etapas no login (Figma seção 12, tela 12): código de 6 dígitos do app autenticador, com a
 * alternativa de um código de recuperação. Sem desafio em andamento (ex.: recarregou a página) volta ao login.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthShellComponent, BannerComponent, ButtonComponent],
  selector: 'app-mfa-code',
  templateUrl: './mfa-code.component.html',
})
export class MfaCodeComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  protected readonly code = signal('');
  protected readonly useRecovery = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<MfaCodeError | null>(null);
  protected readonly isDesktop = inject(ViewportBreakpointService).isDesktop;
  /** Erro do campo (código errado ou vazio); bloqueio, desafio vencido e falta de rede vão ao aviso do topo. */
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

  private readonly gateway = inject(MfaGateway);
  private readonly challenge = inject(MfaChallengeStore);
  private readonly session = inject(LocalSessionStore);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (this.challenge.current() === null) {
      void this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }

  protected onCode(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value);
  }

  protected toggleRecovery(): void {
    this.useRecovery.update(value => !value);
    this.code.set('');
    this.error.set(null);
  }

  protected goToLogin(): void {
    this.challenge.current.set(null);
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  protected submit(event?: Event): void {
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
    const request = this.useRecovery()
      ? this.gateway.recover(challenge.token, code)
      : this.gateway.verify(challenge.token, code);

    void request.then(result => {
      this.loading.set(false);
      this.handle(result);
    });
  }

  private handle(result: MfaResult): void {
    if (result.kind === 'success') {
      this.challenge.current.set(null);
      this.session.open(result.tokens);
      void this.router.navigate(['/splash'], { queryParams: { returnUrl: safeReturnUrl(null) }, replaceUrl: true });

      return;
    }
    this.error.set(result.kind);
    if (result.kind === 'expired') {
      this.challenge.current.set(null);
    }
  }
}
