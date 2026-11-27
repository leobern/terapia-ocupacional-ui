import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { LocalSessionStore } from '../auth/local-session-store';
import { MfaChallengeStore, MfaGateway, MfaResult, MfaSetup } from './mfa-gateway';
import { MfaSetupComponent } from './mfa-setup.component';

class FakeGateway extends MfaGateway {
  verify!: jasmine.Spy<(challenge: string, code: string) => Promise<MfaResult>>;
  recover!: jasmine.Spy<(challenge: string, code: string) => Promise<MfaResult>>;
  beginSetup!: jasmine.Spy<(challenge: string) => Promise<MfaSetup | null>>;
  confirmSetup!: jasmine.Spy<(challenge: string, code: string) => Promise<MfaResult>>;
}

describe('MfaSetupComponent', () => {
  let gateway: FakeGateway;
  let fixture: ComponentFixture<MfaSetupComponent>;
  let router: Router;
  let el: HTMLElement;

  const confirmed: MfaResult = {
    kind: 'success',
    recoveryCodes: ['A7K2-9QXM', 'LP4D-83ZC'],
    tokens: { accessToken: 'a', refreshToken: 'r' },
  };

  async function open(withChallenge = true): Promise<void> {
    if (withChallenge) {
      TestBed.inject(MfaChallengeStore).current.set({ setupRequired: true, token: 'desafio' });
    }
    fixture = TestBed.createComponent(MfaSetupComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const input = (): HTMLInputElement => el.querySelector('#mfa-setup-code') as HTMLInputElement;
  const buttonByText = (text: string): HTMLButtonElement | undefined =>
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes(text));

  async function activate(code: string): Promise<void> {
    input().value = code;
    input().dispatchEvent(new Event('input'));
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    gateway = new FakeGateway();
    gateway.beginSetup = jasmine
      .createSpy('beginSetup')
      .and.resolveTo({ otpauthUri: 'otpauth://totp/Conductia?secret=ABCDEFGHIJKLMNOP', secret: 'ABCDEFGHIJKLMNOP' });
    gateway.confirmSetup = jasmine.createSpy('confirmSetup').and.resolveTo(confirmed);
    TestBed.configureTestingModule({
      imports: [MfaSetupComponent],
      providers: [provideRouter([]), { provide: MfaGateway, useValue: gateway }],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => localStorage.clear());

  it('mostra a chave em grupos e o link do app autenticador (Figma 13)', async () => {
    await open();

    expect(gateway.beginSetup).toHaveBeenCalledOnceWith('desafio');
    expect(el.textContent).toContain('Ative a verificação em duas etapas');
    expect(el.querySelector('.auth-qr__secret')?.textContent).toBe('ABCD EFGH IJKL MNOP');
    expect(el.querySelector('.auth-qr a')?.getAttribute('href')).toContain('otpauth://');
  });

  it('sem desafio volta ao login e não chama o serviço', async () => {
    await open(false);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
    expect(gateway.beginSetup).not.toHaveBeenCalled();
  });

  it('falha ao gerar a chave avisa e mantém o botão desabilitado', async () => {
    gateway.beginSetup.and.resolveTo(null);
    await open();

    expect(el.querySelector('app-banner')?.textContent).toContain('Não foi possível gerar a chave');
    expect((el.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('código correto mostra os códigos de recuperação e só então abre a sessão (Figma 14)', async () => {
    await open();
    await activate('123456');

    expect(gateway.confirmSetup).toHaveBeenCalledOnceWith('desafio', '123456');
    expect(el.textContent).toContain('Guarde seus códigos de recuperação');
    expect(Array.from(el.querySelectorAll('.auth-codes__item')).map(i => i.textContent)).toEqual([
      'A7K2-9QXM',
      'LP4D-83ZC',
    ]);

    expect(TestBed.inject(LocalSessionStore).accessToken()).toBeNull();

    buttonByText('Já guardei os códigos')?.click();

    expect(TestBed.inject(LocalSessionStore).accessToken()).toBe('a');
    expect(TestBed.inject(MfaChallengeStore).current()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/splash'], { queryParams: { returnUrl: null }, replaceUrl: true });
  });

  it('finish sem tokens pendentes não faz nada', async () => {
    await open();
    (fixture.componentInstance as unknown as { finish(): void }).finish();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('copia os códigos para a área de transferência', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();

    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText } as unknown as Clipboard);
    await open();
    await activate('123456');
    buttonByText('Copiar códigos')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledOnceWith('A7K2-9QXM\nLP4D-83ZC');
    expect(el.textContent).toContain('Códigos copiados');
  });

  it('falha ao copiar não marca como copiado', async () => {
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({
      writeText: () => Promise.reject(new Error('negado')),
    } as unknown as Clipboard);
    await open();
    await activate('123456');
    buttonByText('Copiar códigos')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).not.toContain('Códigos copiados');
  });

  it('código vazio, errado e outras falhas aparecem sem abrir a sessão', async () => {
    await open();
    await activate('  ');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Informe o código');
    gateway.confirmSetup.and.resolveTo({ kind: 'invalid-code' });
    await activate('000000');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Código incorreto');
    gateway.confirmSetup.and.resolveTo({ kind: 'locked' });
    await activate('000000');

    expect(el.querySelector('app-banner')?.textContent).toContain('Muitas tentativas');
    expect(TestBed.inject(LocalSessionStore).accessToken()).toBeNull();
  });

  it('não envia duas vezes enquanto confirma', async () => {
    await open();
    gateway.confirmSetup.and.returnValue(new Promise(() => undefined));
    await activate('123456');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(gateway.confirmSetup).toHaveBeenCalledTimes(1);
  });

  it('"Sair" limpa o desafio e volta ao login', async () => {
    await open();
    buttonByText('Sair')?.click();

    expect(TestBed.inject(MfaChallengeStore).current()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });
});
