import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewportBreakpointService } from '../../services/viewport-breakpoint.service';
import { DrawerComponent, type DrawerSnap } from './drawer.component';

/** Foco preso no drawer expandido (modal) e o que acontece quando ele não pode ser dispensado. */
describe('DrawerComponent — foco e dispensa', () => {
  let fixture: ComponentFixture<DrawerComponent>;

  const dialog = (): HTMLDialogElement => fixture.nativeElement.querySelector('dialog');
  const focusables = (): HTMLElement[] =>
    Array.from(dialog().querySelectorAll<HTMLElement>('button:not([disabled])')).filter(el => el.offsetParent !== null);
  const tab = (shiftKey = false): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab', shiftKey });

    dialog().dispatchEvent(event);

    return event;
  };
  const open = (snap: DrawerSnap): void => {
    fixture.componentRef.setInput('snap', snap);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawerComponent],
      providers: [{ provide: ViewportBreakpointService, useValue: { isDesktop: signal(true).asReadonly() } }],
    }).compileComponents();
    fixture = TestBed.createComponent(DrawerComponent);
    fixture.componentRef.setInput('ariaLabel', 'Assistente de IA');
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('Tab no último elemento volta para o primeiro (modal)', () => {
    open('expanded');
    const items = focusables();

    items[items.length - 1].focus();
    const event = tab();

    expect(event.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(items[0]);
  });

  it('Shift+Tab no primeiro elemento vai para o último (modal)', () => {
    open('expanded');
    const items = focusables();

    items[0].focus();
    const event = tab(true);

    expect(event.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('Tab no meio da lista segue o fluxo normal do navegador', () => {
    open('expanded');
    const items = focusables();

    items[0].focus();

    expect(tab().defaultPrevented).toBeFalse();
  });

  it('outras teclas e o modo não modal não prendem o foco', () => {
    open('expanded');
    dialog().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a' }));

    fixture.componentRef.setInput('snap', 'default');
    fixture.detectChanges();
    const items = focusables();

    items[items.length - 1].focus();

    expect(tab().defaultPrevented).toBeFalse();
  });

  it('sem dispensa (dismissible=false) o drawer não fecha nem muda de encaixe', () => {
    fixture.componentRef.setInput('dismissible', false);
    open('expanded');
    let closed = 0;
    let snaps = 0;

    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.componentInstance.snapChange.subscribe(() => snaps++);
    (fixture.componentInstance as unknown as { onCloseClick(): void }).onCloseClick();

    expect([closed, snaps]).toEqual([0, 0]);
  });

  it('reabrir no mesmo modo não reabre o dialog', () => {
    open('default');
    const el = dialog();

    fixture.componentRef.setInput('ariaLabel', 'Outro rótulo');
    fixture.detectChanges();

    expect(dialog()).toBe(el);
    expect(el.open).toBeTrue();
  });
});
