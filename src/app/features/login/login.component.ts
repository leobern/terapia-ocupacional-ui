import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconLogoComponent } from '../../shared/components/icon-logo/icon-logo.component';
import { I18nService } from '../../shared/services/i18n.service';
import { LocalSessionStore } from '../auth/local-session-store';
import { safeReturnUrl } from '../auth/return-url';
import { AuthGateway } from './auth-gateway';

export type LoginError = 'invalid-credentials' | 'locked' | 'network-error' | 'validation';

/** Formato mínimo `x@y.z`, sem regex (evita backtracking). */
function isEmailShaped(value: string): boolean {
  const at = value.indexOf('@');
  const dot = value.lastIndexOf('.');

  return at > 0 && dot > at + 1 && dot < value.length - 1 && !/\s/.test(value) && value.indexOf('@', at + 1) === -1;
}

/**
 * Login com e-mail e senha (US-001-1-03). Não há componente de campo de texto no DS: usa `<input>` nativo
 * com o chrome compartilhado (`input-shell`, o mesmo do campo de seleção). Desenho do agente com os componentes
 * existentes (logo, botão, tipografia e tokens): não há frame de login no Figma, ainda não validado pelo Thiago.
 * A mensagem de credencial inválida é genérica (não revela se o e-mail existe).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconLogoComponent, RouterLink],
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

  /** Aviso vindo da navegação (ex.: sessão expirada), exibido acima do formulário. */
  protected readonly notice = signal<string>(this.readNotice());

  /** Bloqueio informado pelo servidor (RN02): impede novas tentativas. */
  protected readonly locked = signal(false);

  private unlockTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly gateway = inject(AuthGateway);
  private readonly session = inject(LocalSessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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
          // Abre a sessão persistida (com refresh token) e deixa a splash decidir o destino: ela atualiza os
          // vínculos (GET /v1/vinculos) e roteia; a rota pedida antes do login (`returnUrl`) segue junto.
          this.session.open(result.tokens);
          // `replaceUrl`: voltar não retorna ao formulário.
          void this.router.navigate(['/splash'], {
            queryParams: { returnUrl: safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')) },
            replaceUrl: true,
          });
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

  private readNotice(): string {
    const notice = (history.state as { notice?: unknown } | null)?.notice;

    return typeof notice === 'string' ? notice : '';
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
