import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { I18nService } from '../../shared/services/i18n.service';
import { decideDestination } from '../splash/splash-destination';
import { StartupStateReader } from '../splash/startup-state';
import { AuthGateway } from './auth-gateway';

export type LoginError = 'invalid-credentials' | 'locked' | 'network-error' | 'validation';

/** Formato mínimo `x@y.z`, sem regex (evita backtracking). */
function isEmailShaped(value: string): boolean {
  const at = value.indexOf('@');
  const dot = value.lastIndexOf('.');

  return at > 0 && dot > at + 1 && dot < value.length - 1 && !/\s/.test(value) && value.indexOf('@', at + 1) === -1;
}

/**
 * Login com e-mail e senha (US-001-1-03). Não há componente de campo de texto no DS:
 * usa `<input>` nativo estilizado só com tokens (ponto de atenção no PR).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, RouterLink],
  selector: 'app-login',
  styleUrl: './login.component.scss',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<LoginError | null>(null);
  protected readonly errorMessage = computed(() => {
    const error = this.error();

    return error === null ? '' : this.i18n.t(`login.error.${error}`);
  });

  /** Bloqueio informado pelo servidor (RN02): impede novas tentativas. */
  protected readonly locked = signal(false);

  private unlockTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly gateway = inject(AuthGateway);
  private readonly reader = inject(StartupStateReader);
  private readonly router = inject(Router);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.unlockTimer));
  }

  protected submit(): void {
    if (this.loading() || this.locked()) {
      return;
    }
    const email = this.email().trim();

    // Validação só de formato/preenchimento: nada sobre existência de contas.
    if (!isEmailShaped(email) || this.password() === '') {
      this.error.set('validation');

      return;
    }
    this.error.set(null);
    this.loading.set(true);
    void this.gateway.login(email, this.password()).then(result => {
      this.loading.set(false);
      switch (result.kind) {
        case 'invalid-credentials':
          this.password.set('');
          this.error.set('invalid-credentials');
          break;
        case 'network-error':
          this.error.set('network-error');
          break;
        case 'success':
          this.reader.registerLogin(result.hasApprovedHospitalLink);
          // `replaceUrl`: voltar não retorna ao formulário (RN03 reaproveita a regra da splash).
          void this.router.navigateByUrl(decideDestination(this.reader.readLocal()), { replaceUrl: true });
          break;
        case 'locked':
          this.lock(result.retryAfterSeconds);
          break;
      }
    });
  }

  protected onInput(field: 'email' | 'password', event: Event): void {
    (field === 'email' ? this.email : this.password).set((event.target as HTMLInputElement).value);
  }

  private lock(retryAfterSeconds: number | undefined): void {
    this.password.set('');
    this.error.set('locked');
    // Sem tempo restante do servidor, o envio segue liberado para nova tentativa manual
    // (o front não fixa duração; o servidor responde `locked` de novo se ainda valer).
    if (retryAfterSeconds !== undefined) {
      this.locked.set(true);
      this.unlockTimer = setTimeout(() => {
        this.locked.set(false);
        this.error.set(null);
      }, retryAfterSeconds * 1000);
    }
  }
}
