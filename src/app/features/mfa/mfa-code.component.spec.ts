import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { LocalSessionStore } from '../auth/local-session-store';
import { MfaCodeComponent } from './mfa-code.component';
import { MfaChallengeStore, MfaGateway, MfaResult, MfaSetup } from './mfa-gateway';

class FakeGateway extends MfaGateway {
  verify!: jasmine.Spy<(challenge: string, code: string) => Promise<MfaResult>>;
  recover!: jasmine.Spy<(challenge: string, code: string) => Promise<MfaResult>>;
  beginSetup!: jasmine.Spy<(challenge: string) => Promise<MfaSetup | null>>;
  confirmSetup!: jasmine.Spy<(challenge: string, code: string) => Promise<MfaResult>>;
}

describe('MfaCodeComponent', () => {
  let gateway: FakeGateway;
  let fixture: ComponentFixture<MfaCodeComponent>;
  let router: Router;
  let el: HTMLElement;

  const ok: MfaResult = { kind: 'success', tokens: { accessToken: 'a', refreshToken: 'r' } };

  function open(withChallenge = true): void {
    if (withChallenge) {
      TestBed.inject(MfaChallengeStore).current.set({ setupRequired: false, token: 'desafio' });
    }
    fixture = TestBed.createComponent(MfaCodeComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const input = (): HTMLInputElement => el.querySelector('#mfa-code') as HTMLInputElement;

  async function type(value: string): Promise<void> {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    gateway = new FakeGateway();
    gateway.verify = jasmine.createSpy('verify').and.resolveTo(ok);
    gateway.recover = jasmine.createSpy('recover').and.resolveTo(ok);
    TestBed.configureTestingModule({
      imports: [MfaCodeComponent],
      providers: [provideRouter([]), { provide: MfaGateway, useValue: gateway }],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => localStorage.clear());

  it('mostra o campo de 6 dígitos numérico (Figma 12)', () => {
    open();

    expect(el.textContent).toContain('Verificação em duas etapas');
    expect(input().getAttribute('inputmode')).toBe('numeric');
    expect(input().getAttribute('maxlength')).toBe('6');
    expect(input().getAttribute('autocomplete')).toBe('one-time-code');
  });

  it('sem desafio em andamento volta ao login', () => {
    open(false);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('código correto abre a sessão e segue para a splash', async () => {
    open();
    await type(' 123456 ');

    expect(gateway.verify).toHaveBeenCalledOnceWith('desafio', '123456');
    expect(TestBed.inject(LocalSessionStore).accessToken()).toBe('a');
    expect(TestBed.inject(MfaChallengeStore).current()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/splash'], { queryParams: { returnUrl: null }, replaceUrl: true });
  });

  it('vazio pede o código sem chamar o serviço', async () => {
    open();
    await type('  ');

    expect(gateway.verify).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Informe o código');
  });

  it('código errado mostra erro no campo', async () => {
    open();
    gateway.verify.and.resolveTo({ kind: 'invalid-code' });
    await type('000000');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Código incorreto');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('bloqueio e falta de rede aparecem no aviso amarelo', async () => {
    open();
    gateway.verify.and.resolveTo({ kind: 'locked' });
    await type('000000');

    expect(el.querySelector('app-banner')?.textContent).toContain('Muitas tentativas');
    gateway.verify.and.resolveTo({ kind: 'network-error' });
    await type('000000');

    expect(el.querySelector('app-banner')?.textContent).toContain('Sem conexão');
  });

  it('desafio expirado limpa o desafio e avisa', async () => {
    open();
    gateway.verify.and.resolveTo({ kind: 'expired' });
    await type('000000');

    expect(el.querySelector('app-banner')?.textContent).toContain('expirou');
    expect(TestBed.inject(MfaChallengeStore).current()).toBeNull();
  });

  it('o link alterna para o código de recuperação e usa o outro endpoint', async () => {
    open();
    (el.querySelector('.auth-link--button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Código de recuperação');
    expect(input().getAttribute('inputmode')).toBe('text');
    await type('AAAA-BBBB');

    expect(gateway.recover).toHaveBeenCalledOnceWith('desafio', 'AAAA-BBBB');
    expect(gateway.verify).not.toHaveBeenCalled();
  });

  it('voltar para o app autenticador restaura o campo de 6 dígitos', () => {
    open();
    const toggle = el.querySelector('.auth-link--button') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();
    toggle.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Código de 6 dígitos');
  });

  it('não envia duas vezes enquanto verifica', async () => {
    open();
    gateway.verify.and.returnValue(new Promise(() => undefined));
    await type('123456');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(gateway.verify).toHaveBeenCalledTimes(1);
  });

  it('goToLogin limpa o desafio e volta ao login', () => {
    open();
    (fixture.componentInstance as unknown as { goToLogin(): void }).goToLogin();

    expect(TestBed.inject(MfaChallengeStore).current()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });
});
