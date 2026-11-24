import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogoutConfirmComponent } from './logout-confirm.component';

describe('LogoutConfirmComponent', () => {
  let fixture: ComponentFixture<LogoutConfirmComponent>;
  let el: HTMLElement;
  let confirmed: jasmine.Spy;
  let cancelled: jasmine.Spy;

  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes(label));

  beforeEach(() => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    fixture = TestBed.createComponent(LogoutConfirmComponent);
    el = fixture.nativeElement as HTMLElement;
    confirmed = jasmine.createSpy('confirmed');
    cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.cancelled.subscribe(cancelled);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('shows an accessible modal with the confirmation text', () => {
    const dialog = el.querySelector('dialog') as HTMLDialogElement;

    expect(dialog.open).toBeTrue();
    expect(dialog.getAttribute('aria-label')).toBe('Confirmar saída da conta');
    expect(el.textContent).toContain('Deseja sair da conta?');
  });

  it('emits confirmed when the user confirms', () => {
    button('Sair')?.click();

    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('disables Confirm and does not emit while busy', () => {
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();

    expect(button('Sair')?.disabled).toBeTrue();
    button('Sair')?.click();

    expect(confirmed).not.toHaveBeenCalled();
  });

  it('emits cancelled when the user cancels', () => {
    button('Cancelar')?.click();

    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('emits cancelled when the dialog is dismissed (Esc)', () => {
    (el.querySelector('dialog') as HTMLDialogElement).dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});
