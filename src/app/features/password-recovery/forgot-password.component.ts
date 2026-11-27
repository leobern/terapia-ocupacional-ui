import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthShellComponent } from '../../shared/components/auth-shell/auth-shell.component';
import { BannerComponent } from '../../shared/components/banner/banner.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { I18nService } from '../../shared/services/i18n.service';
import { ViewportBreakpointService } from '../../shared/services/viewport-breakpoint.service';
import { PasswordResetGateway } from './password-reset-gateway';

export type ForgotPasswordState = 'FORM' | 'SENDING' | 'SENT';

function isValidEmail(value: string): boolean {
  const parts = value.split('@');
  const domain = parts[1] ?? '';
  const dot = domain.indexOf('.');

  return parts.length === 2 && !/\s/.test(value) && parts[0].length > 0 && dot > 0 && dot < domain.length - 1;
}

/** Solicitação do link de redefinição (US-001-1-06, cenários 1 e 2). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthShellComponent, BannerComponent, ButtonComponent],
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent {
  protected readonly state = signal<ForgotPasswordState>('FORM');
  protected readonly email = signal('');
  protected readonly validationError = signal<string | null>(null);
  protected readonly serviceError = signal(false);
  protected readonly i18n = inject(I18nService);
  protected readonly isDesktop = inject(ViewportBreakpointService).isDesktop;

  private readonly gateway = inject(PasswordResetGateway);
  private readonly router = inject(Router);

  protected goToLogin(): void {
    void this.router.navigateByUrl('/login');
  }

  /** "Reenviar e-mail" (Figma 08): volta ao formulário com o e-mail já digitado e envia de novo. */
  protected resend(): void {
    this.state.set('FORM');
    this.submit();
  }

  /** Ao sair do campo: e-mail preenchido fora do formato `texto@texto.texto` mostra o erro (vazio só falha no envio). */
  protected validateEmail(): void {
    const email = this.email().trim();

    this.validationError.set(
      email === '' || isValidEmail(email) ? null : this.i18n.t('passwordRecovery.forgot.emailInvalid'),
    );
  }

  protected onInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    if (this.state() !== 'FORM') {
      return;
    }
    const email = this.email().trim();

    if (!email) {
      this.validationError.set(this.i18n.t('passwordRecovery.forgot.emailRequired'));

      return;
    }
    if (!isValidEmail(email)) {
      this.validationError.set(this.i18n.t('passwordRecovery.forgot.emailInvalid'));

      return;
    }
    this.validationError.set(null);
    this.serviceError.set(false);
    this.state.set('SENDING');
    // RN03: 'sent' e 'unknown-email' levam exatamente ao mesmo estado.
    this.gateway.requestReset(email).then(
      () => this.state.set('SENT'),
      () => {
        this.serviceError.set(true);
        this.state.set('FORM');
      },
    );
  }
}
