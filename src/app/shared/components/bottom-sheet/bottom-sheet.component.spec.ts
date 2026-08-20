import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewportBreakpointService } from '../../services/viewport-breakpoint.service';
import { ViewportKeyboardService } from '../../services/viewport-keyboard.service';
import { BottomSheetComponent, type BottomSheetSnap, type ChatShortcut } from './bottom-sheet.component';

/**
 * Os testes rodam em Chrome headless REAL (Karma), não jsdom — é o que torna
 * `<dialog>`, `showModal()`, top layer e Pointer Events verificáveis de verdade.
 *
 * Os arrastes usam deltas propositalmente enormes (±5000px) ou minúsculos (2px):
 * o objetivo é cruzar (ou não cruzar) qualquer limiar positivo sem depender da
 * altura exata que o iframe do Karma dá ao sheet, que varia com a janela.
 */
describe('BottomSheetComponent', () => {
  let fixture: ComponentFixture<BottomSheetComponent>;

  // Signals, não spies: o componente deriva o encaixe efetivo desses sinais com
  // `computed()`, então um spy que só troca de valor de retorno não notificaria
  // nada e o teste do teclado passaria por acidente (ou falharia por acidente).
  let isDesktop: WritableSignal<boolean>;
  let isKeyboardOpen: WritableSignal<boolean>;

  function dialog(): HTMLDialogElement {
    return fixture.nativeElement.querySelector('dialog');
  }

  function header(): HTMLElement {
    return fixture.nativeElement.querySelector('.bottom-sheet__header');
  }

  function closeButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.bottom-sheet__close button');
  }

  function shortcutButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.bottom-sheet__shortcut button'));
  }

  function actionsBand(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.bottom-sheet__actions');
  }

  function openSheet(snap: BottomSheetSnap = 'default'): void {
    fixture.componentRef.setInput('snap', snap);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  }

  /** Um gesto completo no cabeçalho. `deltaY` positivo = para baixo. */
  function drag(deltaY: number): void {
    const target = header();

    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 0, pointerId: 1 }));
    target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: deltaY, pointerId: 1 }));
    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientY: deltaY, pointerId: 1 }));

    fixture.detectChanges();
  }

  beforeEach(async () => {
    isDesktop = signal(false);
    isKeyboardOpen = signal(false);

    await TestBed.configureTestingModule({
      imports: [BottomSheetComponent],
      providers: [
        { provide: ViewportBreakpointService, useValue: { isDesktop: isDesktop.asReadonly() } },
        {
          provide: ViewportKeyboardService,
          useValue: {
            isVirtualKeyboardOpen: isKeyboardOpen.asReadonly(),
            keyboardInsetPx: signal(0).asReadonly(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BottomSheetComponent);
    fixture.componentRef.setInput('ariaLabel', 'Assistente de IA');

    fixture.detectChanges();
  });

  afterEach(() => {
    // Um `<dialog>` modal deixado aberto vaza foco preso e rolagem travada para o
    // próximo spec — destruir é obrigatório, não higiene opcional.
    fixture.destroy();
  });

  // ---------------------------------------------------------------------------
  // T008 — dispensa e acessibilidade
  // ---------------------------------------------------------------------------

  it('abre o dialog em modo modal quando `open` vira true', () => {
    expect(dialog().open).toBeFalse();

    openSheet();

    expect(dialog().open).toBeTrue();
  });

  it('expõe role, aria-modal e o rótulo recebido', () => {
    openSheet();

    expect(dialog().getAttribute('role')).toBe('dialog');
    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(dialog().getAttribute('aria-label')).toBe('Assistente de IA');
  });

  it('emite (closed) uma única vez ao acionar o botão de fechar', () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    openSheet();

    closeButton()?.click();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('emite (closed) uma única vez ao tocar no scrim', () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    openSheet();

    // Clique no ::backdrop chega ao DOM com o próprio <dialog> como target — é
    // assim que o navegador reporta, e é o que distingue scrim de conteúdo.
    dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('emite (closed) uma única vez com Esc', () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    openSheet();

    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('emite (closed) uma única vez ao arrastar o cabeçalho para baixo além do limiar', () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    openSheet();

    drag(5000);

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('não emite (closed) por nenhum caminho quando dismissible=false', () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentRef.setInput('dismissible', false);
    openSheet();

    expect(closeButton()).toBeNull();

    dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    drag(5000);

    expect(closed).not.toHaveBeenCalled();
    expect(dialog().open).toBeTrue();
  });

  it('não fecha ao clicar dentro do conteúdo do sheet', () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    openSheet();

    header().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(closed).not.toHaveBeenCalled();
  });

  it('oculta o logo do cabeçalho quando showLogo=false', () => {
    openSheet();

    expect(fixture.nativeElement.querySelector('.bottom-sheet__logo')).not.toBeNull();

    fixture.componentRef.setInput('showLogo', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.bottom-sheet__logo')).toBeNull();
  });

  it('mantém a alça de arraste fora da árvore de acessibilidade', () => {
    openSheet();

    const handle = fixture.nativeElement.querySelector('.bottom-sheet__handle');

    // Decorativa e não focável: o único efeito exclusivo do arraste (fechar) tem
    // equivalente por teclado (Esc) e por ponteiro (X). Ver spec.md § Acessibilidade.
    expect(handle.getAttribute('aria-hidden')).toBe('true');
    expect(handle.hasAttribute('tabindex')).toBeFalse();
  });

  it('coloca o foco no botão de fechar ao abrir', () => {
    openSheet();

    // Primeiro focável na ordem do DOM: o logo é decorativo e a alça não é focável,
    // então o algoritmo de foco inicial do <dialog> chega ao X (SC-005).
    expect(document.activeElement).toBe(closeButton());
  });

  it('devolve o foco ao elemento que abriu o sheet', () => {
    const trigger = document.createElement('button');

    document.body.appendChild(trigger);
    trigger.focus();

    expect(document.activeElement).toBe(trigger);

    openSheet();

    expect(document.activeElement).not.toBe(trigger);

    // Restauração nativa do <dialog>: é justamente o que dispensa implementar
    // focus trap à mão (research.md §1).
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });

  it('estende o alvo de toque do botão de fechar para 44x44 sem mexer na caixa visual', () => {
    openSheet();

    const hitArea: HTMLElement = fixture.nativeElement.querySelector('.bottom-sheet__close');
    const button: HTMLElement = fixture.nativeElement.querySelector('.bottom-sheet__close button');
    const target = hitArea.getBoundingClientRect();
    const visual = button.getBoundingClientRect();

    // A caixa VISUAL — o `<button>` que o usuário vê — continua 32x32 (FR-017)...
    expect(Math.round(visual.width)).toBe(32);
    expect(Math.round(visual.height)).toBe(32);

    // ...enquanto a caixa que responde ao toque mede 44x44.
    expect(Math.round(target.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(target.height)).toBeGreaterThanOrEqual(44);

    // ...e essa caixa maior envolve a visual por todos os lados, então todo ponto
    // dos 44x44 cai no `<span>` ou num descendente dele.
    expect(target.left).toBeLessThan(visual.left);
    expect(target.top).toBeLessThan(visual.top);
    expect(target.right).toBeGreaterThan(visual.right);
    expect(target.bottom).toBeGreaterThan(visual.bottom);

    // E é o `<span>` que carrega o `(click)`: um evento originado na faixa ampliada
    // (fora do `<button>`) dispensa o sheet.
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    hitArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(closed).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // T009 — pontos de encaixe
  // ---------------------------------------------------------------------------

  it('assenta em full ao arrastar para cima, emitindo (snapChange) uma vez', () => {
    const snapChange = jasmine.createSpy('snapChange');

    fixture.componentInstance.snapChange.subscribe(snapChange);
    openSheet('default');

    drag(-5000);

    expect(snapChange).toHaveBeenCalledOnceWith('full');
  });

  it('recolhe de full para default ao arrastar para baixo, sem fechar', () => {
    const snapChange = jasmine.createSpy('snapChange');
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.snapChange.subscribe(snapChange);
    fixture.componentInstance.closed.subscribe(closed);
    openSheet('full');

    drag(5000);

    expect(snapChange).toHaveBeenCalledOnceWith('default');
    expect(closed).not.toHaveBeenCalled();
    expect(dialog().open).toBeTrue();
  });

  it('volta ao encaixe de origem quando o arraste não atinge o limiar', () => {
    const snapChange = jasmine.createSpy('snapChange');
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.snapChange.subscribe(snapChange);
    fixture.componentInstance.closed.subscribe(closed);
    openSheet('default');

    drag(2);

    expect(snapChange).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });

  it('emite snapChange("default") ANTES de closed ao fechar a partir de full', () => {
    const order: string[] = [];

    fixture.componentInstance.snapChange.subscribe(snap => order.push(`snap:${snap}`));
    fixture.componentInstance.closed.subscribe(() => order.push('closed'));
    openSheet('full');

    closeButton()?.click();

    // A ordem é o requisito: com `closed` primeiro, o consumidor poderia desmontar
    // antes de receber a correção do encaixe e reabriria expandido (FR-025).
    expect(order).toEqual(['snap:default', 'closed']);
  });

  it('não emite snapChange redundante ao fechar já estando em default', () => {
    const order: string[] = [];

    fixture.componentInstance.snapChange.subscribe(snap => order.push(`snap:${snap}`));
    fixture.componentInstance.closed.subscribe(() => order.push('closed'));
    openSheet('default');

    closeButton()?.click();

    expect(order).toEqual(['closed']);
  });

  it('acompanha o dedo durante o gesto e solta o controle ao terminar', () => {
    openSheet('default');

    const target = header();

    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 0, pointerId: 1 }));
    target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: 40, pointerId: 1 }));
    fixture.detectChanges();

    expect(dialog().classList).toContain('bottom-sheet--dragging');
    expect(dialog().style.translate).toBe('0px 40px');

    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientY: 40, pointerId: 1 }));
    fixture.detectChanges();

    // Fora do gesto o estilo inline sai e as classes do SCSS voltam a mandar.
    expect(dialog().classList).not.toContain('bottom-sheet--dragging');
    expect(dialog().style.translate).toBe('');
  });

  it('volta ao encaixe de origem quando o sistema cancela o ponteiro', () => {
    const snapChange = jasmine.createSpy('snapChange');
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.snapChange.subscribe(snapChange);
    fixture.componentInstance.closed.subscribe(closed);
    openSheet('default');

    const target = header();

    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 0, pointerId: 1 }));
    target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: 5000, pointerId: 1 }));
    target.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
    fixture.detectChanges();

    // Chamada recebida no meio do gesto não pode dispensar a conversa.
    expect(closed).not.toHaveBeenCalled();
    expect(snapChange).not.toHaveBeenCalled();
    expect(dialog().style.translate).toBe('');
  });

  it('ignora movimento e soltura sem um pointerdown anterior', () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    openSheet('default');

    const target = header();

    target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: 5000, pointerId: 1 }));
    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientY: 5000, pointerId: 1 }));
    fixture.detectChanges();

    expect(closed).not.toHaveBeenCalled();
    expect(dialog().style.translate).toBe('');
  });

  it('não desloca o sheet no arraste para cima, mas ainda reconhece o gesto', () => {
    const snapChange = jasmine.createSpy('snapChange');

    fixture.componentInstance.snapChange.subscribe(snapChange);
    openSheet('default');

    const target = header();

    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 500, pointerId: 1 }));
    target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: 100, pointerId: 1 }));
    fixture.detectChanges();

    // Ancorado no rodapé com altura fixa por encaixe: deslocar para cima abriria
    // uma faixa vazia embaixo. O gesto vale, o deslocamento não. (O navegador
    // normaliza `0 0px` para `0px`.)
    expect(dialog().style.translate).toBe('0px');

    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientY: 100, pointerId: 1 }));
    fixture.detectChanges();

    expect(snapChange).toHaveBeenCalledOnceWith('full');
  });

  it('clareia o scrim conforme o sheet desce e restaura ao soltar', () => {
    openSheet('default');

    const target = header();

    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 0, pointerId: 1 }));
    target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: 5000, pointerId: 1 }));
    fixture.detectChanges();

    const duringDrag = Number(dialog().style.getPropertyValue('--bottom-sheet-scrim-opacity'));

    expect(duringDrag).toBeLessThan(1);

    target.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
    fixture.detectChanges();

    // Fora do gesto a custom property sai e o CSS volta a mandar (fallback `1`).
    expect(dialog().style.getPropertyValue('--bottom-sheet-scrim-opacity')).toBe('');
  });

  it('não arrasta a partir da região de conteúdo', () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    openSheet('default');

    const content: HTMLElement = fixture.nativeElement.querySelector('.bottom-sheet__content');

    content.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 0, pointerId: 1 }));
    content.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: 5000, pointerId: 1 }));
    content.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientY: 5000, pointerId: 1 }));
    fixture.detectChanges();

    // Rolar a conversa até o topo e continuar puxando NÃO pode dispensar o sheet.
    expect(closed).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // T010 — efeitos no documento e breakpoint
  // ---------------------------------------------------------------------------

  it('trava a rolagem do documento enquanto está aberto e restaura ao fechar', () => {
    openSheet();

    expect(document.documentElement.style.overflow).toBe('hidden');

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();

    expect(document.documentElement.style.overflow).not.toBe('hidden');
  });

  it('restaura a rolagem ao ser destruído ainda aberto', () => {
    openSheet();

    expect(document.documentElement.style.overflow).toBe('hidden');

    // Destruição sem transição (navegação de rota, por exemplo): sem esta limpeza
    // a página inteira fica travada para sempre (FR-007).
    fixture.destroy();

    expect(document.documentElement.style.overflow).not.toBe('hidden');
  });

  it('não renderiza nem abre nada em desktop, mesmo com open=true', () => {
    isDesktop.set(true);

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(dialog()).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // T021 — atalhos rápidos
  // ---------------------------------------------------------------------------

  it('não renderiza a faixa de atalhos com a lista vazia', () => {
    openSheet();

    expect(actionsBand()).toBeNull();
  });

  it('renderiza no máximo 3 atalhos, ignorando os excedentes', () => {
    const many: ChatShortcut[] = Array.from({ length: 5 }, (_, index) => ({
      id: `s${index}`,
      label: `Atalho ${index}`,
    }));

    fixture.componentRef.setInput('shortcuts', many);
    openSheet();

    expect(shortcutButtons().length).toBe(3);
    expect(shortcutButtons()[0].textContent).toContain('Atalho 0');
    expect(shortcutButtons()[2].textContent).toContain('Atalho 2');
  });

  it('emite (shortcutSelect) com o item completo, não só o id', () => {
    const selected = jasmine.createSpy('selected');
    const shortcut: ChatShortcut = { id: 'pendencias', label: 'Quais são minhas pendências de hoje?' };

    fixture.componentInstance.shortcutSelect.subscribe(selected);
    fixture.componentRef.setInput('shortcuts', [shortcut]);
    openSheet();

    shortcutButtons()[0].click();

    expect(selected).toHaveBeenCalledOnceWith(shortcut);
  });

  it('não fecha o sheet ao acionar um atalho', () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentRef.setInput('shortcuts', [{ id: 'a', label: 'A' }]);
    openSheet();

    shortcutButtons()[0].click();

    expect(closed).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // T022 — teclado virtual
  // ---------------------------------------------------------------------------

  it('vai a full quando o teclado virtual abre e permanece lá quando ele fecha', () => {
    const snapChange = jasmine.createSpy('snapChange');

    fixture.componentInstance.snapChange.subscribe(snapChange);
    openSheet('default');

    isKeyboardOpen.set(true);
    fixture.detectChanges();

    expect(snapChange).toHaveBeenCalledOnceWith('full');
    expect(dialog().classList).toContain('bottom-sheet--full');

    // Ao fechar o teclado o sheet NÃO recolhe sozinho: voltar seria um salto de
    // layout não pedido; o usuário recolhe arrastando (spec.md § Clarifications).
    fixture.componentRef.setInput('snap', 'full');
    isKeyboardOpen.set(false);
    fixture.detectChanges();

    expect(dialog().classList).toContain('bottom-sheet--full');
  });
});
