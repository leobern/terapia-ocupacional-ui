import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemeService } from '../../services/theme.service';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthShellComponent],
  template: `
    <app-auth-shell [brand]="brand()" [title]="title()" [text]="text()" [statusText]="status()">
      <p class="projetado">conteúdo</p>
    </app-auth-shell>
  `,
})
class HostComponent {
  readonly brand = signal(true);
  readonly title = signal('Entrar');
  readonly text = signal('Use seu e-mail');
  readonly status = signal(false);
}

describe('AuthShellComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;
  let theme: ThemeService;

  beforeEach(() => {
    localStorage.removeItem('conductia-theme');
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    theme = TestBed.inject(ThemeService);
    theme.set('light');
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    theme.set('light');
    localStorage.removeItem('conductia-theme');
  });

  it('mostra título, texto e o conteúdo projetado', () => {
    expect(el.querySelector('h1')?.textContent).toContain('Entrar');
    expect(el.querySelector('.auth-shell__text')?.textContent).toContain('Use seu e-mail');
    expect(el.querySelector('.projetado')).not.toBeNull();
  });

  it('com `brand` mostra o nome Conductia e o divisor; sem, só o ícone', () => {
    expect(el.querySelector('.auth-shell__brand')?.textContent).toBe('Conductia');
    expect(el.querySelector('.auth-shell__logo--brand')).not.toBeNull();

    host.brand.set(false);
    fixture.detectChanges();

    expect(el.querySelector('.auth-shell__brand')).toBeNull();
    expect(el.querySelector('.auth-shell__logo--brand')).toBeNull();
  });

  it('sem título não renderiza o bloco de título; sem texto, só o título', () => {
    host.text.set('');
    fixture.detectChanges();

    expect(el.querySelector('.auth-shell__text')).toBeNull();
    host.title.set('');
    fixture.detectChanges();

    expect(el.querySelector('.auth-shell__heading')).toBeNull();
  });

  it('`statusText` anuncia o texto como status', () => {
    expect(el.querySelector('.auth-shell__text')?.getAttribute('role')).toBeNull();

    host.status.set(true);
    fixture.detectChanges();

    expect(el.querySelector('.auth-shell__text')?.getAttribute('role')).toBe('status');
  });

  it('o alternador troca o tema e marca o botão ativo', () => {
    const [light, dark] = Array.from(el.querySelectorAll<HTMLButtonElement>('.auth-shell__theme-button'));

    expect(light.getAttribute('aria-pressed')).toBe('true');
    dark.click();
    fixture.detectChanges();

    expect(theme.theme()).toBe('dark');
    expect(dark.getAttribute('aria-pressed')).toBe('true');
    expect(light.getAttribute('aria-pressed')).toBe('false');
  });
});
