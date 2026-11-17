import { signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewportBreakpointService } from '../../services/viewport-breakpoint.service';
import { type ChatShortcut } from '../bottom-sheet/bottom-sheet.component';
import { DrawerComponent, type DrawerSnap } from './drawer.component';

/**
 * Os testes rodam em Chrome headless REAL (Karma), não jsdom — é o que torna
 * `<dialog>`, `show()`/`showModal()` e top layer verificáveis de verdade.
 */
describe('DrawerComponent', () => {
  let fixture: ComponentFixture<DrawerComponent>;
  let isDesktop: WritableSignal<boolean>;

  function dialog(): HTMLDialogElement {
    return fixture.nativeElement.querySelector('dialog');
  }

  function expandButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.drawer__expand button');
  }

  function closeButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.drawer__close button');
  }

  function shortcutButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.drawer__shortcut button'));
  }

  function actionsBand(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.drawer__actions');
  }

  function openDrawer(snap: DrawerSnap = 'default'): void {
    fixture.componentRef.setInput('snap', snap);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  }

  function setSnap(snap: DrawerSnap): void {
    fixture.componentRef.setInput('snap', snap);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    isDesktop = signal(true);

    await TestBed.configureTestingModule({
      imports: [DrawerComponent],
      providers: [{ provide: ViewportBreakpointService, useValue: { isDesktop: isDesktop.asReadonly() } }],
    }).compileComponents();

    fixture = TestBed.createComponent(DrawerComponent);
    fixture.componentRef.setInput('ariaLabel', 'Assistente de IA');

    fixture.detectChanges();
  });

  afterEach(() => {
    // Um `<dialog>` modal deixado aberto vaza foco preso para o próximo spec —
    // destruir é obrigatório, não higiene opcional.
    fixture.destroy();
  });

  // ---------------------------------------------------------------------------
  // T005 — dispensa e ARIA
  // ---------------------------------------------------------------------------

  it('não renderiza o dialog quando isDesktop é falso, mesmo com open=true', () => {
    isDesktop.set(false);

    openDrawer();

    expect(dialog()).toBeNull();
  });

  it('abre o dialog em modo não-modal (role="complementary") em snap="default"', () => {
    openDrawer('default');

    expect(dialog().open).toBeTrue();
    expect(dialog().getAttribute('role')).toBe('complementary');
    expect(dialog().hasAttribute('aria-modal')).toBeFalse();
    expect(dialog().getAttribute('aria-label')).toBe('Assistente de IA');
  });

  it('abre o dialog em modo modal (role="dialog" + aria-modal) em snap="expanded"', () => {
    openDrawer('expanded');

    expect(dialog().open).toBeTrue();
    expect(dialog().getAttribute('role')).toBe('dialog');
    expect(dialog().getAttribute('aria-modal')).toBe('true');
  });

  it('emite (closed) uma única vez ao acionar o botão de fechar', () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    openDrawer();

    closeButton()?.click();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('não renderiza o botão de fechar quando dismissible=false, e nada emite', () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentRef.setInput('dismissible', false);
    openDrawer();

    expect(closeButton()).toBeNull();
    expect(closed).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // T006 — toggle de snap
  // ---------------------------------------------------------------------------

  it('alterna snap ao clicar no botão de expandir e emite (snapChange) uma vez', () => {
    const snapChange = jasmine.createSpy('snapChange');

    fixture.componentInstance.snapChange.subscribe(snapChange);
    openDrawer('default');

    expandButton()?.click();

    expect(snapChange).toHaveBeenCalledTimes(1);
    expect(snapChange).toHaveBeenCalledWith('expanded');
  });

  it('recolhe ao clicar de novo no botão de expandir', () => {
    const snapChange = jasmine.createSpy('snapChange');

    fixture.componentInstance.snapChange.subscribe(snapChange);
    openDrawer('expanded');

    expandButton()?.click();

    expect(snapChange).toHaveBeenCalledOnceWith('default');
  });

  it('fechar a partir de expanded emite snapChange(default) ANTES de closed', () => {
    const calls: string[] = [];

    fixture.componentInstance.snapChange.subscribe(() => calls.push('snapChange'));
    fixture.componentInstance.closed.subscribe(() => calls.push('closed'));
    openDrawer('expanded');

    closeButton()?.click();

    expect(calls).toEqual(['snapChange', 'closed']);
  });

  it('fechar a partir de default NÃO emite snapChange', () => {
    const snapChange = jasmine.createSpy('snapChange');

    fixture.componentInstance.snapChange.subscribe(snapChange);
    openDrawer('default');

    closeButton()?.click();

    expect(snapChange).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // T007 — foco
  // ---------------------------------------------------------------------------

  it('ao expandir, move o foco para o primeiro elemento focável do drawer', () => {
    openDrawer('default');

    setSnap('expanded');

    expect(dialog().contains(document.activeElement)).toBeTrue();
  });

  it('ao recolher, restaura o foco ao elemento focado antes da expansão', () => {
    openDrawer('default');
    closeButton()?.focus();

    expect(document.activeElement).toBe(closeButton());

    setSnap('expanded');

    expect(document.activeElement).not.toBe(closeButton());

    setSnap('default');

    expect(document.activeElement).toBe(closeButton());
  });

  // ---------------------------------------------------------------------------
  // T008 — `--drawer-width` e guard de breakpoint
  // ---------------------------------------------------------------------------

  it('define --drawer-width em document.documentElement conforme open/snap', () => {
    const readWidth = (): string => document.documentElement.style.getPropertyValue('--drawer-width');

    expect(readWidth()).toBe('0px');

    openDrawer('default');

    expect(readWidth()).toBe('480px');

    setSnap('expanded');

    expect(readWidth()).toBe('calc(100vw - var(--space-72))');

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();

    expect(readWidth()).toBe('0px');
  });

  // ---------------------------------------------------------------------------
  // T016 — atalhos rápidos
  // ---------------------------------------------------------------------------

  it('renderiza no máximo 3 atalhos mesmo recebendo 5', () => {
    const shortcuts: ChatShortcut[] = Array.from({ length: 5 }, (_, index) => ({
      id: `s${index}`,
      label: `Atalho ${index}`,
    }));

    fixture.componentRef.setInput('shortcuts', shortcuts);
    openDrawer();

    expect(shortcutButtons().length).toBe(3);
  });

  it('não renderiza a faixa de atalhos (nem o padding) quando shortcuts está vazio', () => {
    fixture.componentRef.setInput('shortcuts', []);
    openDrawer();

    expect(actionsBand()).toBeNull();
  });

  it('emite (shortcutSelect) com o item completo ao acionar um atalho', () => {
    const shortcut: ChatShortcut = { id: 's1', label: 'Atalho' };
    const shortcutSelect = jasmine.createSpy('shortcutSelect');

    fixture.componentInstance.shortcutSelect.subscribe(shortcutSelect);
    fixture.componentRef.setInput('shortcuts', [shortcut]);
    openDrawer();

    shortcutButtons()[0].click();

    expect(shortcutSelect).toHaveBeenCalledOnceWith(shortcut);
  });
});
