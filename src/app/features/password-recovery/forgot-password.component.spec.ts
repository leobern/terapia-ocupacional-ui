import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

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

  async function fillAndSubmit(value: string): Promise<void> {
    const input = el.querySelector('input') as HTMLInputElement;

    input.value = value;
    input.dispatchEvent(new Event('input'));
    el.querySelector('button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('has a labelled e-mail field and a link back to login', () => {
    const input = el.querySelector('input') as HTMLInputElement;

    expect(el.querySelector(`label[for="${input.id}"]`)?.textContent).toContain('E-mail');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/login');
  });

  it('C1: sends the e-mail and shows the confirmation', async () => {
    await fillAndSubmit('medico@hospital.com');

    expect(gateway.requestReset).toHaveBeenCalledOnceWith('medico@hospital.com');
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Verifique seu e-mail');
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
    el.querySelector('button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(gateway.requestReset).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[role="status"]')).not.toBeNull();
  });

  it('does not allow double submit while sending', async () => {
    gateway.requestReset.and.returnValue(new Promise(() => undefined));
    await fillAndSubmit('medico@hospital.com');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    el.querySelector('app-button')?.dispatchEvent(new Event('click'));

    expect(gateway.requestReset).toHaveBeenCalledTimes(1);
    expect(el.querySelector('button')?.disabled).toBeTrue();
  });
});
