import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthShellComponent } from '../../../shared/components/auth-shell/auth-shell.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { PasswordFieldComponent } from '../../../shared/components/password-field/password-field.component';
import { I18nService } from '../../../shared/services/i18n.service';
import { ViewportBreakpointService } from '../../../shared/services/viewport-breakpoint.service';
import { LogoutService } from '../logout.service';
import { AccountPasswordVerifier, PasswordCheck } from './account-password-verifier';
import { BiometricAuth } from './biometric-auth';
import { InactivityLockService } from './inactivity-lock.service';

/** Chave de texto de cada motivo de recusa da senha. */
const PASSWORD_MESSAGE_KEYS = {
  invalid: 'lock.passwordError',
  locked: 'lock.passwordLocked',
  unavailable: 'lock.passwordUnavailable',
} as const;

/** RN-04: falhas consecutivas de biometria antes de pedir a senha. */
export const MAX_BIOMETRIC_FAILURES = 3;

/**
 * LockScreen (US-001-1-08, RN-03/04). Não exibe nenhum dado clínico. Desbloqueio primário
 * por biometria; após 3 falhas seguidas ou sem biometria, por senha da conta. Desenho do
 * agente com componentes existentes do design system (não há frame no Figma).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthShellComponent, ButtonComponent, PasswordFieldComponent],
  selector: 'app-lock-screen',
  templateUrl: './lock-screen.component.html',
})
export class LockScreenComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  /** `checking` enquanto se descobre se há biometria; depois `biometric` ou `password`. */
  protected readonly mode = signal<'checking' | 'biometric' | 'password'>('checking');
  /** Motivo da recusa da senha (`invalid`, `locked` ou `unavailable`); `null` sem erro. */
  protected readonly passwordIssue = signal<Exclude<PasswordCheck, 'ok'> | null>(null);
  protected readonly biometricFailed = signal(false);
  protected readonly busy = signal(false);
  protected readonly passwordMessageKey = PASSWORD_MESSAGE_KEYS;
  protected readonly isDesktop = inject(ViewportBreakpointService).isDesktop;
  /** Senha digitada (o campo é o `app-password-field`, com mostrar/ocultar). */
  protected readonly password = signal('');

  private readonly biometric = inject(BiometricAuth);
  private readonly verifier = inject(AccountPasswordVerifier);
  private readonly lock = inject(InactivityLockService);
  private readonly router = inject(Router);
  private readonly logoutService = inject(LogoutService);
  private failures = 0;

  async ngOnInit(): Promise<void> {
    if (await this.biometric.isAvailable().catch(() => false)) {
      this.mode.set('biometric');
      await this.tryBiometric();
    } else {
      this.mode.set('password');
    }
  }

  protected async tryBiometric(): Promise<void> {
    if (this.busy()) {
      return;
    }

    this.busy.set(true);
    const ok = await this.biometric.authenticate().catch(() => false);

    this.busy.set(false);

    if (ok) {
      await this.unlock();

      return;
    }

    this.biometricFailed.set(true);
    this.failures++;

    if (this.failures >= MAX_BIOMETRIC_FAILURES) {
      this.mode.set('password');
    }
  }

  protected onPassword(value: string): void {
    this.password.set(value);
    this.passwordIssue.set(null);
  }

  /** "Sair da conta" (Figma 15): encerra a sessão deste dispositivo e volta ao login. */
  protected async signOut(): Promise<void> {
    await this.logoutService.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  protected async submitPassword(event?: Event): Promise<void> {
    event?.preventDefault();

    if (this.busy()) {
      return;
    }

    this.busy.set(true);
    const check = await this.verifier.verify(this.password()).catch((): PasswordCheck => 'unavailable');

    this.busy.set(false);

    if (check === 'ok') {
      await this.unlock();
    } else {
      this.passwordIssue.set(check);
    }
  }

  private async unlock(): Promise<void> {
    const target = this.lock.returnUrl();

    this.failures = 0;
    this.lock.unlock();
    await this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
