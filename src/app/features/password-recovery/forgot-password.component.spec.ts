import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ForgotPasswordComponent } from './forgot-password.component';
import { ConfirmResetResult, PasswordResetGateway, RequestResetResult } from './password-reset-gateway';

class FakeGateway extends PasswordResetGateway {
  requestReset!: jasmine.Spy<(email: string) => Promise<RequestResetResult>>;
  confirmReset!: jasmine.Spy<(token: string, password: string) => Promise<ConfirmResetResult>>;
}

describe('ForgotPasswordComponent', () => {
  let gateway: FakeGateway;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    gateway = new FakeGateway();
    gateway.requestReset = jasmine.createSpy('requestReset').and.resolveTo('sent');
    gateway.confirmReset = jasmine.createSpy('confirmReset').and.resolveTo('ok');
    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideRouter([]), { provide: PasswordResetGateway, useValue: gateway }],
    });
    fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  const submitButton = (): HTMLButtonElement | null => el.querySelector('button[type="submit"]');

  async function fillAndSubmit(value: string): Promise<void> {
    const input = el.querySelector('input') as HTMLInputElement;

    input.value = value;
    input.dispatchEvent(new Event('input'));
    submitButton()?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('has a labelled e-mail field and a link back to login', () => {
    const input = el.querySelector('input') as HTMLInputElement;

    expect(el.querySelector(`label[for="${input.id}"]`)?.textContent).toContain('E-mail');
    expect(el.querySelector('app-auth-shell')).not.toBeNull();
    expect(el.textContent).toContain('Voltar para o login');
  });

  it('C1: sends the e-mail and shows the confirmation', async () => {
    await fillAndSubmit('medico@hospital.com');

    expect(gateway.requestReset).toHaveBeenCalledOnceWith('medico@hospital.com');
    expect(el.querySelector('h1')?.textContent).toContain('Confira seu e-mail');
    const message = el.querySelector('[role="status"]')?.textContent ?? '';

    expect(message).toContain('caixa de spam');
    expect(message).not.toContain('Confira seu e-mail');
    // RN03: a mensagem não revela se a conta existe.
    expect(message).toContain('Se o e-mail informado estiver cadastrado');
  });

  it('C2/RN03: unknown e-mail shows the very same confirmation', async () => {
    await fillAndSubmit('medico@hospital.com');
    const known = el.querySelector('main')?.textContent;

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    gateway.requestReset.and.resolveTo('unknown-email');
    await fillAndSubmit('nao@existe.com');

    expect(el.querySelector('main')?.textContent).toBe(known);
  });

  it('valida o formato do e-mail ao sair do campo (type e-mail)', () => {
    const input = el.querySelector('input') as HTMLInputElement;

    expect(input.type).toBe('email');
    input.value = 'abc@dominio';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('e-mail válido');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('blocks empty e-mail without calling the service', async () => {
    await fillAndSubmit('  ');

    expect(gateway.requestReset).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Informe seu e-mail');
    expect(el.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('blocks malformed e-mail without calling the service', async () => {
    await fillAndSubmit('abc');

    expect(gateway.requestReset).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('e-mail válido');
  });

  it('shows a generic error on failure and allows retrying', async () => {
    gateway.requestReset.and.rejectWith(new Error('offline'));
    await fillAndSubmit('medico@hospital.com');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível');
    expect(el.querySelector('[role="status"]')).toBeNull();

    gateway.requestReset.and.resolveTo('sent');
    submitButton()?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(gateway.requestReset).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[role="status"]')).not.toBeNull();
  });

  it('does not allow double submit while sending', async () => {
    gateway.requestReset.and.returnValue(new Promise(() => undefined));
    await fillAndSubmit('medico@hospital.com');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    submitButton()?.dispatchEvent(new Event('click'));

    expect(gateway.requestReset).toHaveBeenCalledTimes(1);
    expect(submitButton()?.disabled).toBeTrue();
  });
});

describe('ForgotPasswordComponent (ações)', () => {
  let gateway: FakeGateway;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let router: Router;
  let el: HTMLElement;

  beforeEach(() => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    gateway = new FakeGateway();
    gateway.requestReset = jasmine.createSpy('requestReset').and.resolveTo('sent');
    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideRouter([]), { provide: PasswordResetGateway, useValue: gateway }],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  const buttonByText = (text: string): HTMLButtonElement | undefined =>
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes(text));

  async function sendEmail(): Promise<void> {
    const input = el.querySelector('input') as HTMLInputElement;

    input.value = 'medico@hospital.com';
    input.dispatchEvent(new Event('input'));
    buttonByText('Enviar link')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('"Voltar para o login" leva ao login (Figma 07)', () => {
    buttonByText('Voltar para o login')?.click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('"Reenviar e-mail" envia de novo para o mesmo endereço (Figma 08)', async () => {
    await sendEmail();
    buttonByText('Reenviar e-mail')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(gateway.requestReset).toHaveBeenCalledTimes(2);
    expect(gateway.requestReset.calls.mostRecent().args[0]).toBe('medico@hospital.com');
    expect(el.textContent).toContain('Confira seu e-mail');
  });

  it('na confirmação, "Voltar para o login" também leva ao login', async () => {
    await sendEmail();
    buttonByText('Voltar para o login')?.click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
