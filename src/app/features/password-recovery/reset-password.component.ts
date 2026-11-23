import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { validatePassword } from '../../shared/auth/password-policy';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { I18nService } from '../../shared/services/i18n.service';
import { PasswordResetGateway } from './password-reset-gateway';

export type ResetPasswordState = 'FORM' | 'SUBMITTING' | 'LINK_EXPIRED';

/** Definição da nova senha pelo link do e-mail (US-001-1-06, cenários 3 e 4). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, RouterLink],
  selector: 'app-reset-password',
  styleUrl: './password-recovery.component.scss',
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

  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  private readonly gateway = inject(PasswordResetGateway);
  private readonly router = inject(Router);

  constructor() {
    if (!this.token) {
      this.state.set('LINK_EXPIRED');
    }
  }

  protected onPassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  protected onConfirmation(event: Event): void {
    this.confirmation.set((event.target as HTMLInputElement).value);
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
          void this.router.navigateByUrl('/login', { replaceUrl: true });
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
