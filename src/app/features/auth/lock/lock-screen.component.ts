import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { IconLogoComponent } from '../../../shared/components/icon-logo/icon-logo.component';
import { I18nService } from '../../../shared/services/i18n.service';
import { AccountPasswordVerifier } from './account-password-verifier';
import { BiometricAuth } from './biometric-auth';
import { InactivityLockService } from './inactivity-lock.service';

/** RN-04: falhas consecutivas de biometria antes de pedir a senha. */
export const MAX_BIOMETRIC_FAILURES = 3;

/**
 * LockScreen (US-001-1-08, RN-03/04). Não exibe nenhum dado clínico. Desbloqueio primário
 * por biometria; após 3 falhas seguidas ou sem biometria, por senha da conta. Desenho do
 * agente com componentes existentes do design system (não há frame no Figma).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconLogoComponent],
  selector: 'app-lock-screen',
  styleUrl: './lock-screen.component.scss',
  templateUrl: './lock-screen.component.html',
})
export class LockScreenComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  /** `checking` enquanto se descobre se há biometria; depois `biometric` ou `password`. */
  protected readonly mode = signal<'checking' | 'biometric' | 'password'>('checking');
  protected readonly passwordError = signal(false);
  protected readonly biometricFailed = signal(false);
  protected readonly busy = signal(false);

  private readonly biometric = inject(BiometricAuth);
  private readonly verifier = inject(AccountPasswordVerifier);
  private readonly lock = inject(InactivityLockService);
  private readonly router = inject(Router);
  private failures = 0;
  private password = '';

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

  protected onPasswordInput(event: Event): void {
    this.password = (event.target as HTMLInputElement).value;
    this.passwordError.set(false);
  }

  protected async submitPassword(event?: Event): Promise<void> {
    event?.preventDefault();

    if (this.busy()) {
      return;
    }

    this.busy.set(true);
    const ok = await this.verifier.verify(this.password).catch(() => false);

    this.busy.set(false);

    if (ok) {
      await this.unlock();
    } else {
      this.passwordError.set(true);
    }
  }

  private async unlock(): Promise<void> {
    const target = this.lock.returnUrl();

    this.failures = 0;
    this.lock.unlock();
    await this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
