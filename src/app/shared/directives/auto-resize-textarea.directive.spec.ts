import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { AutoResizeTextareaDirective } from './auto-resize-textarea.directive';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AutoResizeTextareaDirective],
  template: `<textarea appAutoResizeTextarea></textarea>`,
})
class HostComponent {
  readonly directive = viewChild.required(AutoResizeTextareaDirective);
}

describe('AutoResizeTextareaDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let textarea: HTMLTextAreaElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    textarea = fixture.nativeElement.querySelector('textarea');
  });

  /**
   * `scrollHeight` é 0 num elemento sem layout real (headless), então a altura
   * resultante em px não é testável aqui — ver research.md §6. O que estes
   * testes garantem é o PROTOCOLO: o reset para `auto` acontece ANTES da
   * leitura, que é a parte que, se quebrar, faz o campo só crescer e nunca
   * encolher. A altura real fica para o checkpoint de UI.
   */
  function stubScrollHeight(value: number): void {
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value });
  }

  it('reseta a altura para "auto" antes de ler scrollHeight', () => {
    const observedDuringRead: string[] = [];

    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      get: () => {
        observedDuringRead.push(textarea.style.height);

        return 84;
      },
    });

    fixture.componentInstance.directive().resize();

    expect(observedDuringRead).toEqual(['auto']);
  });

  it('aplica a altura lida de scrollHeight', () => {
    stubScrollHeight(84);

    fixture.componentInstance.directive().resize();

    expect(textarea.style.height).toBe('84px');
  });

  it('encolhe quando o conteúdo diminui (o reset é o que torna isso possível)', () => {
    stubScrollHeight(120);
    fixture.componentInstance.directive().resize();

    expect(textarea.style.height).toBe('120px');

    stubScrollHeight(44);
    fixture.componentInstance.directive().resize();

    expect(textarea.style.height).toBe('44px');
  });

  it('reajusta no evento input, sem chamada manual', () => {
    stubScrollHeight(66);

    textarea.dispatchEvent(new Event('input'));

    expect(textarea.style.height).toBe('66px');
  });

  it('nao declara max-height — o teto vive no CSS do ancestral rolavel', () => {
    stubScrollHeight(999);

    fixture.componentInstance.directive().resize();

    expect(textarea.style.maxHeight).toBe('');
  });
});
