import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmptyCardComponent } from './empty-card.component';

describe('EmptyCardComponent', () => {
  let fixture: ComponentFixture<EmptyCardComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EmptyCardComponent);
    fixture.componentRef.setInput('text', 'Toque aqui e insira o diagnóstico.');
    fixture.detectChanges();
  });

  it('mostra a legenda de convite', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Toque aqui e insira o diagnóstico.');
  });

  it('tocar no card avisa a tela', () => {
    let activated = 0;

    fixture.componentInstance.activate.subscribe(() => activated++);
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();

    expect(activated).toBe(1);
  });

  it('desabilitado (somente leitura) não aciona o cadastro', () => {
    let activated = 0;

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    fixture.componentInstance.activate.subscribe(() => activated++);
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();

    expect(activated).toBe(0);
  });
});
