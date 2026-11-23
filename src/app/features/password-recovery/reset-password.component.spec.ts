import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { ConfirmResetResult, PasswordResetGateway, RequestResetResult } from './password-reset-gateway';
import { ResetPasswordComponent } from './reset-password.component';

class FakeGateway extends PasswordResetGateway {
  requestReset!: jasmine.Spy<(email: string) => Promise<RequestResetResult>>;
  confirmReset!: jasmine.Spy<(token: string, password: string) => Promise<ConfirmResetResult>>;
}

describe('ResetPasswordComponent', () => {
  let gateway: FakeGateway;
  let navigate: jasmine.Spy;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let el: HTMLElement;

  let token: string | null;

  beforeEach(() => {
    token = 'tok-1';
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    gateway = new FakeGateway();
    gateway.confirmReset = jasmine.createSpy('confirmReset').and.resolveTo('ok');
    TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: PasswordResetGateway, useValue: gateway },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: (): string | null => token } } } },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
  });

  function open(withToken: string | null = 'tok-1'): void {
    token = withToken;
    fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  async function fillAndSubmit(password: string, confirmation: string): Promise<void> {
    const [p, c] = Array.from(el.querySelectorAll('input'));

    p.value = password;
    p.dispatchEvent(new Event('input'));
    c.value = confirmation;
    c.dispatchEvent(new Event('input'));
    el.querySelector('button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('has labelled password fields', () => {
    open();

    el.querySelectorAll('input').forEach(input => {
      expect(el.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    });
  });

  it('C3: sends token and password and redirects to login', async () => {
    open();
    await fillAndSubmit('Senha123', 'Senha123');

    expect(gateway.confirmReset).toHaveBeenCalledOnceWith('tok-1', 'Senha123');
    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('C4/RN02: expired, used or invalid link shows expiry and a link to request a new one', async () => {
    open();
    gateway.confirmReset.and.resolveTo('invalid-token');
    await fillAndSubmit('Senha123', 'Senha123');

    expect(el.textContent).toContain('expirou');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/forgot-password');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows the expired state when there is no token', () => {
    open(null);

    expect(el.textContent).toContain('expirou');
    expect(el.querySelector('input')).toBeNull();
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/forgot-password');
  });

  it('RN04: rejects a password violating the policy without calling the service', async () => {
    open();
    await fillAndSubmit('abc', 'abc');

    expect(gateway.confirmReset).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('8 caracteres');
    expect(el.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('blocks a mismatching confirmation', async () => {
    open();
    await fillAndSubmit('Senha123', 'Senha124');

    expect(gateway.confirmReset).not.toHaveBeenCalled();
    expect(el.textContent).toContain('não coincidem');
  });

  it('keeps typed values and allows retry after a service failure', async () => {
    open();
    gateway.confirmReset.and.rejectWith(new Error('offline'));
    await fillAndSubmit('Senha123', 'Senha123');

    expect(el.textContent).toContain('Não foi possível');
    expect((el.querySelector('input') as HTMLInputElement).value).toBe('Senha123');

    gateway.confirmReset.and.resolveTo('ok');
    el.querySelector('button')?.click();
    await fixture.whenStable();

    expect(gateway.confirmReset).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('submits with Enter (submit button inside the form, single submission)', async () => {
    open();
    const [p, c] = Array.from(el.querySelectorAll('input'));

    p.value = 'Senha123';
    p.dispatchEvent(new Event('input'));
    c.value = 'Senha123';
    c.dispatchEvent(new Event('input'));

    expect(el.querySelector('button')?.type).toBe('submit');
    // Enter num campo dispara o envio implícito do formulário via botão submit.
    el.querySelector('form')?.requestSubmit();
    await fixture.whenStable();

    expect(gateway.confirmReset).toHaveBeenCalledOnceWith('tok-1', 'Senha123');
    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('does not submit invalid data with Enter', async () => {
    open();
    el.querySelector('form')?.requestSubmit();
    await fixture.whenStable();

    expect(gateway.confirmReset).not.toHaveBeenCalled();
  });

  it('does not allow double submit while sending', async () => {
    open();
    gateway.confirmReset.and.returnValue(new Promise(() => undefined));
    await fillAndSubmit('Senha123', 'Senha123');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(gateway.confirmReset).toHaveBeenCalledTimes(1);
    expect(el.querySelector('button')?.disabled).toBeTrue();
  });
});
