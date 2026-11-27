import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { validatePassword } from '../../shared/auth/password-policy';
import { AuthShellComponent } from '../../shared/components/auth-shell/auth-shell.component';
import { BannerComponent } from '../../shared/components/banner/banner.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { PasswordFieldComponent } from '../../shared/components/password-field/password-field.component';
import { I18nService } from '../../shared/services/i18n.service';
import { ViewportBreakpointService } from '../../shared/services/viewport-breakpoint.service';
import { InviteGateway } from './invite-gateway';

export type AcceptInviteState = 'FORM' | 'SUBMITTING' | 'INVALID';

/**
 * Aceite do convite (Figma "Conductia - V1", seção 12, tela 06): nome completo, senha e confirmação. O token vem do
 * link do e-mail (`?token=`); sem token, ou com token recusado, mostra "convite inválido". Ao criar a conta volta ao
 * login com um aviso (a sessão só nasce no login, com MFA quando o perfil exigir).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthShellComponent, BannerComponent, ButtonComponent, PasswordFieldComponent, RouterLink],
  selector: 'app-accept-invite',
  templateUrl: './accept-invite.component.html',
})
export class AcceptInviteComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly state = signal<AcceptInviteState>('FORM');
  protected readonly fullName = signal('');
  protected readonly password = signal('');
  protected readonly confirmation = signal('');
  protected readonly nameError = signal<string | null>(null);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly confirmationError = signal<string | null>(null);
  protected readonly serviceError = signal(false);
  protected readonly isDesktop = inject(ViewportBreakpointService).isDesktop;

  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  private readonly gateway = inject(InviteGateway);
  private readonly router = inject(Router);

  constructor() {
    if (!this.token) {
      this.state.set('INVALID');
    }
  }

  protected onName(event: Event): void {
    this.fullName.set((event.target as HTMLInputElement).value);
  }

  protected goToLogin(): void {
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    if (this.state() !== 'FORM' || !this.token) {
      return;
    }
    const violations = validatePassword(this.password());

    this.nameError.set(this.fullName().trim() === '' ? this.i18n.t('invite.nameRequired') : null);
    this.passwordError.set(
      violations.length > 0 ? violations.map(v => this.i18n.t(`passwordRecovery.reset.policy.${v}`)).join(' ') : null,
    );
    this.confirmationError.set(
      this.password() === this.confirmation() ? null : this.i18n.t('passwordRecovery.reset.mismatch'),
    );
    if (this.nameError() || this.passwordError() || this.confirmationError()) {
      return;
    }
    this.serviceError.set(false);
    this.state.set('SUBMITTING');
    this.gateway.accept(this.token, this.fullName().trim(), this.password()).then(
      result => {
        if (result === 'invalid-token') {
          this.state.set('INVALID');

          return;
        }
        // Conta criada (ou já existente): segue para o login com o aviso correspondente.
        void this.router.navigateByUrl('/login', {
          replaceUrl: true,
          state: { notice: this.i18n.t(result === 'ok' ? 'invite.created' : 'invite.alreadyRegistered') },
        });
      },
      () => {
        this.serviceError.set(true);
        this.state.set('FORM');
      },
    );
  }
}
