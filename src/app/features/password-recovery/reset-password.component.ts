import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { validatePassword } from '../../shared/auth/password-policy';
import { AuthShellComponent } from '../../shared/components/auth-shell/auth-shell.component';
import { BannerComponent } from '../../shared/components/banner/banner.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { PasswordFieldComponent } from '../../shared/components/password-field/password-field.component';
import { I18nService } from '../../shared/services/i18n.service';
import { ViewportBreakpointService } from '../../shared/services/viewport-breakpoint.service';
import { PasswordResetGateway } from './password-reset-gateway';

export type ResetPasswordState = 'FORM' | 'SUBMITTING' | 'LINK_EXPIRED' | 'DONE';

/** Definição da nova senha pelo link do e-mail (US-001-1-06, cenários 3 e 4). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthShellComponent, BannerComponent, ButtonComponent, PasswordFieldComponent],
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly state = signal<ResetPasswordState>('FORM');
  protected readonly password = signal('');
  protected readonly confirmation = signal('');
  protected readonly passwordError = signal<string | null>(null);
  protected readonly confirmationError = signal<string | null>(null);
  protected readonly serviceError = signal(false);
  protected readonly isDesktop = inject(ViewportBreakpointService).isDesktop;

  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  private readonly gateway = inject(PasswordResetGateway);
  private readonly router = inject(Router);

  constructor() {
    if (!this.token) {
      this.state.set('LINK_EXPIRED');
    }
  }

  protected goToLogin(): void {
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  protected requestNewLink(): void {
    void this.router.navigateByUrl('/forgot-password');
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    if (this.state() !== 'FORM' || !this.token) {
      return;
    }
    const violations = validatePassword(this.password());

    this.passwordError.set(
      violations.length > 0 ? violations.map(v => this.i18n.t(`passwordRecovery.reset.policy.${v}`)).join(' ') : null,
    );
    this.confirmationError.set(
      this.password() === this.confirmation() ? null : this.i18n.t('passwordRecovery.reset.mismatch'),
    );
    if (this.passwordError() || this.confirmationError()) {
      return;
    }
    this.serviceError.set(false);
    this.state.set('SUBMITTING');
    this.gateway.confirmReset(this.token, this.password()).then(
      result => {
        if (result === 'ok') {
          // Figma 11: tela de sucesso antes de voltar ao login.
          this.state.set('DONE');
        } else {
          this.state.set('LINK_EXPIRED');
        }
      },
      () => {
        this.serviceError.set(true);
        this.state.set('FORM');
      },
    );
  }
}
