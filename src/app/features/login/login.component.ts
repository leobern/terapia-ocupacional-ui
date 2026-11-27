import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthShellComponent } from '../../shared/components/auth-shell/auth-shell.component';
import { BannerComponent, type BannerType } from '../../shared/components/banner/banner.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { PasswordFieldComponent } from '../../shared/components/password-field/password-field.component';
import { I18nService } from '../../shared/services/i18n.service';
import { ViewportBreakpointService } from '../../shared/services/viewport-breakpoint.service';
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
  imports: [AuthShellComponent, BannerComponent, ButtonComponent, PasswordFieldComponent, RouterLink],
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly email = signal('');
  protected readonly password = signal('');
  /** Erro de formato do e-mail: aparece ao sair do campo (blur) ou ao enviar, sob o próprio campo. */
  protected readonly emailError = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<LoginError | null>(null);
  protected readonly errorMessage = computed(() => {
    const error = this.error();

    return error === null ? '' : this.i18n.t(`login.error.${error}`);
  });

  /** Erro de credencial/preenchimento: aparece sob o campo de senha (Figma 02). */
  protected readonly fieldError = computed(() => {
    const error = this.error();

    if (error === 'validation') {
      // O e-mail inválido já tem mensagem no próprio campo; aqui sobra só a senha vazia.
      return this.emailError() !== '' && this.password() !== '' ? '' : this.errorMessage();
    }

    return error === 'invalid-credentials' ? this.errorMessage() : '';
  });

  /** Aviso vindo da navegação (ex.: sessão expirada), exibido acima do formulário. */
  protected readonly notice = signal<string>(this.readNotice());

  /** Bloqueio informado pelo servidor (RN02): impede novas tentativas. */
  protected readonly locked = signal(false);

  /** Aviso no topo do card: bloqueio e falta de rede (amarelo) ou sessão expirada/encerrada (azul). */
  protected readonly banner = computed<{ message: string; type: BannerType } | null>(() => {
    const error = this.error();

    if (error === 'locked' || error === 'network-error') {
      return { message: this.errorMessage(), type: 'warning' };
    }
    const notice = this.notice();

    return notice === '' ? null : { message: notice, type: 'info' };
  });

  protected readonly isDesktop = inject(ViewportBreakpointService).isDesktop;

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
      this.validateEmail();
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
    // Com o erro de formato já exibido, ele some assim que o e-mail passa a ser válido.
    if (field === 'email' && this.emailError() !== '' && isEmailShaped(this.email().trim())) {
      this.emailError.set('');
    }
  }

  /** Ao sair do campo: e-mail preenchido fora do formato `texto@texto.texto` mostra o erro (vazio só falha no envio). */
  protected validateEmail(): void {
    const email = this.email().trim();

    this.emailError.set(email === '' || isEmailShaped(email) ? '' : this.i18n.t('login.emailInvalid'));
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
