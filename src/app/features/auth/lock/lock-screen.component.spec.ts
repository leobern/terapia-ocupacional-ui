import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AccountPasswordVerifier } from './account-password-verifier';
import { BiometricAuth } from './biometric-auth';
import { InactivityLockService } from './inactivity-lock.service';
import { LockScreenComponent } from './lock-screen.component';

describe('LockScreenComponent', () => {
  let fixture: ComponentFixture<LockScreenComponent>;
  let el: HTMLElement;
  let navigateByUrl: jasmine.Spy;
  let unlock: jasmine.Spy;
  let verify: jasmine.Spy;
  let authenticate: jasmine.Spy;
  let available: boolean;

  const flush = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const click = (label: string): void => {
    Array.from(el.querySelectorAll('button'))
      .find(b => b.textContent?.includes(label))
      ?.click();
  };
  const typePassword = (value: string): void => {
    const input = el.querySelector('input') as HTMLInputElement;

    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const submit = async (value: string): Promise<void> => {
    typePassword(value);
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await flush();
  };

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(LockScreenComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await flush();
  }

  beforeEach(() => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    available = true;
    navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);
    unlock = jasmine.createSpy('unlock');
    verify = jasmine
      .createSpy('verify')
      .and.callFake((p: string) => Promise.resolve(p === 'correta' ? 'ok' : 'invalid'));
    authenticate = jasmine.createSpy('authenticate').and.resolveTo(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigateByUrl } },
        { provide: InactivityLockService, useValue: { returnUrl: (): string => '/patients/7', unlock } },
        { provide: AccountPasswordVerifier, useValue: { verify } },
        {
          provide: BiometricAuth,
          useValue: {
            authenticate: (): Promise<boolean> => authenticate() as Promise<boolean>,
            isAvailable: (): Promise<boolean> => Promise.resolve(available),
          },
        },
      ],
    });
  });

  it('shows the locked message and no clinical data', async () => {
    available = false;
    await create();
    const text = el.textContent ?? '';

    expect(text).toContain('App bloqueado');
    expect(text).not.toMatch(/paciente|leito/i);
  });

  it('C3: valid biometrics unlock and return to the previous screen', async () => {
    authenticate.and.resolveTo(true);
    await create();

    expect(unlock).toHaveBeenCalledWith();
    expect(navigateByUrl).toHaveBeenCalledWith('/patients/7', { replaceUrl: true });
  });

  it('keeps biometrics on after 1 and 2 failures with a text error, and retries on demand', async () => {
    await create();

    expect(el.querySelector('input')).toBeNull();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('biometria');

    click('Usar biometria');
    await flush();

    expect(el.querySelector('input')).toBeNull();

    authenticate.and.resolveTo(true);
    click('Usar biometria');
    await flush();

    expect(unlock).toHaveBeenCalledWith();
  });

  it('C4: 3 consecutive failures ask for the password; correct password unlocks', async () => {
    await create();
    click('Usar biometria');
    await flush();
    click('Usar biometria');
    await flush();

    expect(el.querySelector('input[type="password"]')).not.toBeNull();

    await submit('correta');

    expect(unlock).toHaveBeenCalledWith();
    expect(navigateByUrl).toHaveBeenCalledWith('/patients/7', { replaceUrl: true });
  });

  it('treats a biometric error as a failure', async () => {
    authenticate.and.rejectWith(new Error('sensor'));
    await create();

    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(unlock).not.toHaveBeenCalled();
  });

  it('goes straight to the password when biometrics are unavailable', async () => {
    available = false;
    await create();

    expect(el.querySelector('input[type="password"]')).not.toBeNull();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('wrong password shows a text error, allows retry and clears the error on typing', async () => {
    available = false;
    await create();
    await submit('errada');

    expect(unlock).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Senha incorreta');
    expect(el.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');

    typePassword('correta');
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')).toBeNull();

    await submit('correta');

    expect(unlock).toHaveBeenCalledWith();
  });

  it('treats a verifier error as an incorrect password', async () => {
    available = false;
    verify.and.rejectWith(new Error('x'));
    await create();
    await submit('qualquer');

    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('tells a locked account apart from a wrong password', async () => {
    available = false;
    verify.and.resolveTo('locked');
    await create();
    await submit('x');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Muitas tentativas');
    expect(el.querySelector('input')?.getAttribute('aria-invalid')).toBeNull();
  });

  it('tells that there is no connection to check the password', async () => {
    available = false;
    verify.and.resolveTo('unavailable');
    await create();
    await submit('x');

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Sem conexão');
    expect(unlock).not.toHaveBeenCalled();
  });

  it('falls back to the password when the availability check fails', async () => {
    const biometric = TestBed.inject(BiometricAuth);

    spyOn(biometric, 'isAvailable').and.rejectWith(new Error('x'));
    await create();

    expect(el.querySelector('input[type="password"]')).not.toBeNull();
  });

  it('ignores a second attempt while one is running', async () => {
    available = false;
    const release = { resolve: (_: string): void => undefined };

    verify.and.returnValue(new Promise<string>(r => (release.resolve = r)));
    await create();
    typePassword('x');
    const form = el.querySelector('form') as HTMLFormElement;

    form.dispatchEvent(new Event('submit'));
    form.dispatchEvent(new Event('submit'));
    release.resolve('invalid');
    await flush();

    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('ignores a biometric retry while one is running', async () => {
    const release = { resolve: (_: boolean): void => undefined };

    authenticate.and.returnValue(new Promise<boolean>(r => (release.resolve = r)));
    fixture = TestBed.createComponent(LockScreenComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    click('Usar biometria');
    release.resolve(false);
    await flush();

    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it('submits without an event object', async () => {
    available = false;
    await create();
    typePassword('correta');
    await (fixture.componentInstance as unknown as { submitPassword(): Promise<void> }).submitPassword();

    expect(unlock).toHaveBeenCalledWith();
  });
});
