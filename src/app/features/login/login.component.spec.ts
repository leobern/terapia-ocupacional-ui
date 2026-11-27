import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';

import { LocalSessionStore } from '../auth/local-session-store';
import { AuthGateway, LoginResult } from './auth-gateway';
import { LoginComponent } from './login.component';

class FakeGateway extends AuthGateway {
  login!: jasmine.Spy<AuthGateway['login']>;
}

describe('LoginComponent', () => {
  let gateway: FakeGateway;
  let fixture: ComponentFixture<LoginComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    gateway = new FakeGateway();
    gateway.login = jasmine.createSpy('login');
    gateway.login.and.resolveTo({ kind: 'invalid-credentials' } satisfies LoginResult);
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthGateway, useValue: gateway }],
    });
    fixture = TestBed.createComponent(LoginComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  const input = (name: string): HTMLInputElement => el.querySelector(`input[name="${name}"]`) as HTMLInputElement;
  const error = (): string => el.querySelector('[role="alert"]')?.textContent?.trim() ?? '';
  const button = (): HTMLButtonElement => el.querySelector('app-button button') as HTMLButtonElement;

  function fill(email: string, password: string): void {
    input('email').value = email;
    input('email').dispatchEvent(new Event('input'));
    input('password').value = password;
    input('password').dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit(): Promise<void> {
    button().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders email, password, submit button and forgot-password link', () => {
    expect(input('email')).toBeTruthy();
    expect(input('password').type).toBe('password');
    expect(button().textContent).toContain('Entrar');
    expect(el.querySelector('a')?.textContent).toContain('Esqueci minha senha');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/forgot-password');
  });

  it('C3: wrong credentials show the generic message and clear only the password', async () => {
    fill('a@b.com', 'wrong');
    await submit();

    expect(gateway.login).toHaveBeenCalledWith('a@b.com', 'wrong');
    expect(error()).toBe('E-mail ou senha incorretos');
    expect(input('password').value).toBe('');
    expect(input('email').value).toBe('a@b.com');
  });

  it('C4/RN01: unknown account yields the exact same observable outcome', async () => {
    // O gateway não distingue os dois casos: ambos chegam como `invalid-credentials`.
    fill('ghost@b.com', 'whatever');
    await submit();

    expect(error()).toBe('E-mail ou senha incorretos');
    expect(input('password').value).toBe('');
  });

  it('shows a distinct message on network failure and keeps the password', async () => {
    gateway.login.and.resolveTo({ kind: 'network-error' } satisfies LoginResult);
    fill('a@b.com', 'secret');
    await submit();

    expect(error()).toBe('Sem conexão. Verifique sua internet.');
    expect(input('password').value).toBe('secret');
  });

  it('validates empty and malformed input before calling the gateway', async () => {
    await submit();

    expect(error()).toContain('e-mail válido');

    fill('not-an-email', 'x');
    await submit();

    expect(input('email').getAttribute('aria-invalid')).toBe('true');

    fill('a@b.com', '');
    await submit();

    expect(gateway.login).not.toHaveBeenCalled();
  });

  it('o campo de e-mail é do tipo e-mail e valida o formato ao sair do campo', () => {
    const email = input('email');
    const emailError = (): string => el.querySelector('#login-email-error')?.textContent?.trim() ?? '';

    expect(email.type).toBe('email');
    // Vazio ao sair do campo não acusa erro (só no envio).
    email.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(emailError()).toBe('');

    for (const invalid of ['abc', 'abc@', 'abc@dominio', '@dominio.com', 'a b@c.com']) {
      email.value = invalid;
      email.dispatchEvent(new Event('input'));
      email.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(emailError()).toBe('Informe um e-mail válido.');
      expect(email.getAttribute('aria-invalid')).toBe('true');
      expect(email.getAttribute('aria-describedby')).toBe('login-email-error');
    }
  });

  it('o erro de formato some assim que o e-mail fica válido', () => {
    const email = input('email');

    email.value = 'abc';
    email.dispatchEvent(new Event('input'));
    email.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(el.querySelector('#login-email-error')).not.toBeNull();
    email.value = 'a@b.com';
    email.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(el.querySelector('#login-email-error')).toBeNull();
    expect(email.getAttribute('aria-invalid')).toBeNull();
  });

  it('a senha tem botão de mostrar/ocultar (eye-closed oculta, eye à mostra)', () => {
    const toggle = el.querySelector('.auth-field__toggle') as HTMLButtonElement;

    expect(input('password').type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar senha');
    expect(toggle.querySelector('i')?.className).toContain('ph-eye-closed');
    toggle.click();
    fixture.detectChanges();

    expect(input('password').type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Ocultar senha');
    expect(toggle.querySelector('i')?.className).toMatch(/ph-eye(?!-)/);
  });

  it('disables the button while loading and ignores double submit', async () => {
    let resolve!: (r: LoginResult) => void;

    gateway.login.and.returnValue(new Promise<LoginResult>(r => (resolve = r)));
    fill('a@b.com', 'secret');
    button().click();
    fixture.detectChanges();

    expect(button().disabled).toBeTrue();
    expect(button().textContent).toContain('Entrando');

    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    (fixture.componentInstance as unknown as { submit(): void }).submit();

    expect(gateway.login).toHaveBeenCalledTimes(1);

    resolve({ kind: 'invalid-credentials' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(button().disabled).toBeFalse();
  });

  it('submits with Enter and clears the previous error on a new attempt', async () => {
    fill('a@b.com', 'wrong');
    await submit();
    fill('a@b.com', 'again');
    // Enter num campo envia o formulário pelo botão submit (envio nativo).
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(gateway.login).toHaveBeenCalledTimes(2);
    expect(error()).toBe('');
  });

  describe('after a successful login', () => {
    let navigate: jasmine.Spy;

    beforeEach(() => {
      localStorage.clear();
      navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      gateway.login.and.resolveTo({
        kind: 'success',
        tokens: { accessToken: 'acc', refreshToken: 'ref' },
      } satisfies LoginResult);
    });

    afterEach(() => localStorage.clear());

    it('opens the persisted session with access and refresh tokens', async () => {
      const store = TestBed.inject(LocalSessionStore);

      fill('a@b.com', 'secret');
      await submit();

      expect(store.isValid()).toBeTrue();
      expect(store.accessToken()).toBe('acc');
      expect(store.refreshToken()).toBe('ref');
    });

    it('hands routing by link state to the splash, replacing the login entry', async () => {
      fill('a@b.com', 'secret');
      await submit();

      expect(navigate).toHaveBeenCalledWith(['/splash'], { queryParams: { returnUrl: null }, replaceUrl: true });
    });

    it('does not open a session on failed login', async () => {
      gateway.login.and.resolveTo({ kind: 'invalid-credentials' } satisfies LoginResult);
      fill('a@b.com', 'bad');
      await submit();

      expect(TestBed.inject(LocalSessionStore).isValid()).toBeFalse();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('rota pedida e aviso', () => {
    it('leva a rota pedida à splash', async () => {
      localStorage.clear();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [LoginComponent],
        providers: [
          provideRouter([]),
          { provide: AuthGateway, useValue: gateway },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl: '/patients/3' }) } },
          },
        ],
      });
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

      gateway.login.and.resolveTo({ kind: 'success', tokens: { accessToken: 'a', refreshToken: 'r' } });
      fixture = TestBed.createComponent(LoginComponent);
      el = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      fill('a@b.com', 'secret');
      await submit();

      expect(navigate).toHaveBeenCalledWith(['/splash'], {
        queryParams: { returnUrl: '/patients/3' },
        replaceUrl: true,
      });
      localStorage.clear();
    });

    it('mostra o aviso de sessão expirada vindo da navegação', () => {
      history.replaceState({ notice: 'Sua sessão expirou. Faça login novamente.' }, '');
      const again = TestBed.createComponent(LoginComponent);

      again.detectChanges();
      history.replaceState(null, '');

      expect((again.nativeElement as HTMLElement).querySelector('[role="status"]')?.textContent).toContain('expirou');
    });

    it('sem aviso não renderiza o parágrafo de status', () => {
      expect(el.querySelector('[role="status"]')).toBeNull();
    });
  });

  describe('locked account', () => {
    beforeEach(() => jasmine.clock().install());

    afterEach(() => jasmine.clock().uninstall());

    it('disables submit with a generic message until the server-provided time elapses', async () => {
      gateway.login.and.resolveTo({ kind: 'locked', retryAfterSeconds: 60 } satisfies LoginResult);
      fill('a@b.com', 'secret');
      await submit();

      expect(error()).toBe('Muitas tentativas. Tente novamente em alguns minutos ou redefina sua senha.');
      expect(button().disabled).toBeTrue();
      expect(input('password').value).toBe('');

      jasmine.clock().tick(59_999);
      (fixture.componentInstance as unknown as { submit(): void }).submit();

      expect(gateway.login).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(1);
      fixture.detectChanges();

      expect(button().disabled).toBeFalse();
      expect(error()).toBe('');
    });

    it('keeps submit available for a manual retry when no remaining time is given', async () => {
      gateway.login.and.resolveTo({ kind: 'locked' } satisfies LoginResult);
      fill('a@b.com', 'secret');
      await submit();

      expect(error()).toBe('Muitas tentativas. Tente novamente em alguns minutos ou redefina sua senha.');
      expect(button().disabled).toBeFalse();
    });

    it('cancels the unlock timer on destroy', async () => {
      gateway.login.and.resolveTo({ kind: 'locked', retryAfterSeconds: 5 } satisfies LoginResult);
      fill('a@b.com', 'secret');
      await submit();
      fixture.destroy();

      expect(() => jasmine.clock().tick(5000)).not.toThrow();
    });
  });
});
