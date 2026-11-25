import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let confirmed: jasmine.Spy;
  let cancelled: jasmine.Spy;
  const buttons = (): HTMLButtonElement[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'));

  beforeEach(() => {
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    confirmed = jasmine.createSpy('confirmed');
    cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.cancelled.subscribe(cancelled);
  });

  it('fechado, não mostra nada e o Esc é ignorado', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(buttons().length).toBe(0);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('aberto, mostra título, texto e as duas ações; cada uma emite o seu evento', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Descartar?');
    fixture.componentRef.setInput('message', 'Perde o texto.');
    fixture.detectChanges();
    const [confirm, cancel] = buttons();

    expect(fixture.nativeElement.textContent).toContain('Descartar?');
    expect(fixture.nativeElement.textContent).toContain('Perde o texto.');
    confirm.click();
    cancel.click();

    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('aberto, o Esc cancela', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('sem texto, não mostra o parágrafo da mensagem', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('message', '');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.confirm-dialog__message')).toBeNull();
  });
});
