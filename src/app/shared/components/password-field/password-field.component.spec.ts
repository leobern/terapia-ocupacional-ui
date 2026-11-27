import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PasswordFieldComponent } from './password-field.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PasswordFieldComponent],
  template: `<app-password-field inputId="campo" describedBy="ajuda" [invalid]="invalid()" [(value)]="value" />`,
})
class HostComponent {
  readonly invalid = signal(false);
  readonly value = signal('');
}

describe('PasswordFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let el: HTMLElement;

  const input = (): HTMLInputElement => el.querySelector('input') as HTMLInputElement;
  const toggle = (): HTMLButtonElement => el.querySelector('button') as HTMLButtonElement;

  beforeEach(() => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('começa oculto, com ícone eye-closed e rótulo "Mostrar senha"', () => {
    expect(input().type).toBe('password');
    expect(input().id).toBe('campo');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(toggle().getAttribute('aria-label')).toBe('Mostrar senha');
    expect(toggle().querySelector('i')?.className).toContain('ph-eye-closed');
  });

  it('o botão alterna entre oculta (eye-closed) e à mostra (eye)', () => {
    toggle().click();
    fixture.detectChanges();

    expect(input().type).toBe('text');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(toggle().getAttribute('aria-label')).toBe('Ocultar senha');
    expect(toggle().querySelector('i')?.className).toMatch(/ph-eye(?!-)/);
    toggle().click();
    fixture.detectChanges();

    expect(input().type).toBe('password');
    expect(toggle().querySelector('i')?.className).toContain('ph-eye-closed');
  });

  it('o botão não envia o formulário (type=button)', () => {
    expect(toggle().type).toBe('button');
  });

  it('sincroniza o valor digitado com o pai e marca o estado inválido', () => {
    input().value = 'Senha12345';
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.value()).toBe('Senha12345');
    expect(input().getAttribute('aria-invalid')).toBeNull();
    expect(input().getAttribute('aria-describedby')).toBe('ajuda');
    fixture.componentInstance.invalid.set(true);
    fixture.detectChanges();

    expect(input().getAttribute('aria-invalid')).toBe('true');
  });
});
