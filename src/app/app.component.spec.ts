import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AppComponent } from './app.component';
import { LogoutService } from './features/auth/logout.service';
import { SessionRevoker } from './features/auth/session-revoker';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: SessionRevoker, useValue: { revokeCurrentDevice: (): Promise<void> => Promise.resolve() } },
        provideRouter([
          { component: DummyComponent, data: { hideShell: true }, path: 'splash' },
          { component: DummyComponent, path: 'home' },
          { component: DummyComponent, path: 'login' },
        ]),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    expect(app).toBeTruthy();
  });

  it('hides the navigation shell on routes flagged hideShell and shows it elsewhere', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(AppComponent);
    const el = fixture.nativeElement as HTMLElement;

    await router.navigateByUrl('/splash');
    fixture.detectChanges();

    expect(el.querySelector('app-nav-menu')).toBeNull();
    expect(el.querySelector('app-bottom-nav-bar')).toBeNull();

    await router.navigateByUrl('/home');
    fixture.detectChanges();

    expect(el.querySelector('app-nav-menu')).not.toBeNull();
    expect(el.querySelector('app-bottom-nav-bar')).not.toBeNull();
  });

  describe('logout', () => {
    let logout: jasmine.Spy;
    let router: Router;
    let fixture: ComponentFixture<AppComponent>;
    let el: HTMLElement;

    const button = (label: string): HTMLButtonElement | undefined =>
      Array.from(el.querySelectorAll('dialog[open] button')).find(b => b.textContent?.trim() === label) as
        HTMLButtonElement | undefined;

    const menuSignOut = (): HTMLButtonElement | undefined =>
      Array.from(el.querySelectorAll('dialog[aria-label="Menu"] button')).find(
        b => b.textContent?.trim() === 'Sair',
      ) as HTMLButtonElement | undefined;

    beforeEach(async () => {
      spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
      logout = jasmine.createSpy('logout').and.resolveTo();
      TestBed.inject(LogoutService).logout = logout as unknown as LogoutService['logout'];
      router = TestBed.inject(Router);
      fixture = TestBed.createComponent(AppComponent);
      el = fixture.nativeElement as HTMLElement;
      await router.navigateByUrl('/home');
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('.nav-menu__link--logout')?.click();
      fixture.detectChanges();
    });

    it('asks for confirmation before ending the session', () => {
      expect(logout).not.toHaveBeenCalled();
      expect(el.textContent).toContain('Deseja sair da conta?');
    });

    it('ends the session and redirects to login on confirm', async () => {
      button('Sair')?.click();
      await fixture.whenStable();

      expect(logout).toHaveBeenCalledTimes(1);
      expect(router.url).toBe('/login');
    });

    it('keeps the session and the route on cancel', async () => {
      button('Cancelar')?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(logout).not.toHaveBeenCalled();
      expect(router.url).toBe('/home');
      expect(el.querySelector<HTMLDialogElement>('dialog')?.open ?? false).toBeFalse();
    });

    it('calls logout once when Confirm is double-clicked and disables the button meanwhile', async () => {
      let release!: () => void;

      logout.and.returnValue(new Promise<void>(resolve => (release = resolve)));
      const confirm = button('Sair') as HTMLButtonElement;

      confirm.click();
      confirm.click();
      fixture.detectChanges();

      expect(logout).toHaveBeenCalledTimes(1);
      expect(button('Sair')?.disabled).toBeTrue();

      release();
      await fixture.whenStable();

      expect(logout).toHaveBeenCalledTimes(1);
      expect(router.url).toBe('/login');
    });

    it('opens the confirmation from the Sair button inside the mobile menu sheet', () => {
      button('Cancelar')?.click();
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('app-bottom-nav-bar button')?.click();
      fixture.detectChanges();
      menuSignOut()?.click();
      fixture.detectChanges();

      expect(el.textContent).toContain('Deseja sair da conta?');
      expect(el.querySelector('dialog[aria-label="Menu"][open]')).toBeNull();
      expect(logout).not.toHaveBeenCalled();
    });

    it('ends the session and goes to /login when confirming from the mobile menu', async () => {
      button('Cancelar')?.click();
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('app-bottom-nav-bar button')?.click();
      fixture.detectChanges();
      menuSignOut()?.click();
      fixture.detectChanges();
      button('Sair')?.click();
      await fixture.whenStable();

      expect(logout).toHaveBeenCalledTimes(1);
      expect(router.url).toBe('/login');
    });

    it('offers the sign out action from the mobile menu', () => {
      // Fecha a confirmação antes: dois sheets abertos juntos vazariam o travamento de rolagem.
      button('Cancelar')?.click();
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('app-bottom-nav-bar button')?.click();
      fixture.detectChanges();

      expect(el.querySelector('dialog[aria-label="Menu"]')).not.toBeNull();
    });
  });
});
