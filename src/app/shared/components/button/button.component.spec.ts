import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<ButtonComponent>;

  function buttonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  function labelEl(): HTMLElement {
    return fixture.nativeElement.querySelector('.button__label');
  }

  // scrollWidth/clientWidth/offsetWidth/getComputedStyle only reflect real layout
  // once the element is part of the live document — `fixture.nativeElement` is
  // detached by default. `:host { display: contents }` means the element itself
  // generates no box, but attaching it still puts `.button` (its only rendered
  // child) into the render tree correctly.
  //
  // IMPORTANT: only ever remove the container THIS helper created — Angular's
  // own TestBed mounts `fixture.nativeElement` under its own internal root by
  // default, and removing that root (e.g. via a blind
  // `fixture.nativeElement.parentElement?.remove()` in afterEach) breaks
  // `TestBed.createComponent` for every subsequent test in the file.
  let attachedContainer: HTMLElement | null = null;

  function attachToDom(containerWidthPx?: number): HTMLElement {
    const container = document.createElement('div');

    if (containerWidthPx !== undefined) {
      container.style.width = `${containerWidthPx}px`;
    }
    container.appendChild(fixture.nativeElement);
    document.body.appendChild(container);
    attachedContainer = container;

    return container;
  }

  afterEach(() => {
    attachedContainer?.remove();
    attachedContainer = null;
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonComponent);
    fixture.componentRef.setInput('label', 'Cadastrar conta');
    fixture.detectChanges();
  });

  it('renders the label', () => {
    expect(buttonEl().textContent?.trim()).toContain('Cadastrar conta');
  });

  it('defaults to kind=primary and appearance=solid', () => {
    const classes = buttonEl().className;

    expect(classes).toContain('button--primary');
    expect(classes).toContain('button--solid');
  });

  const kinds: ('primary' | 'secondary' | 'tertiary')[] = ['primary', 'secondary', 'tertiary'];
  const appearances: ('solid' | 'outlined')[] = ['solid', 'outlined'];

  for (const kind of kinds) {
    for (const appearance of appearances) {
      it(`applies the button--${kind} button--${appearance} classes`, () => {
        fixture.componentRef.setInput('kind', kind);
        fixture.componentRef.setInput('appearance', appearance);
        fixture.detectChanges();

        const classes = buttonEl().className;

        expect(classes).toContain(`button--${kind}`);
        expect(classes).toContain(`button--${appearance}`);
      });
    }
  }

  it('renders a single, unified disabled appearance regardless of kind/appearance', () => {
    fixture.componentRef.setInput('kind', 'tertiary');
    fixture.componentRef.setInput('appearance', 'outlined');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(buttonEl().disabled).toBe(true);
  });

  it('does not render icons by default', () => {
    expect(fixture.nativeElement.querySelector('ph-icon')).toBeNull();
  });

  it('renders iconLeft and iconRight when provided', () => {
    fixture.componentRef.setInput('iconLeft', 'check-circle');
    fixture.componentRef.setInput('iconRight', 'pencil-simple');
    fixture.detectChanges();

    const icons = fixture.debugElement.queryAll(By.directive(PhIconComponent));

    expect(icons.length).toBe(2);
    expect(icons[0].componentInstance.name()).toBe('check-circle');
    expect(icons[1].componentInstance.name()).toBe('pencil-simple');
  });

  it('accepts an empty label without throwing and keeps the button element present', () => {
    fixture.componentRef.setInput('label', '');
    fixture.detectChanges();

    expect(buttonEl()).toBeTruthy();
    expect(buttonEl().textContent?.trim()).toBe('');
  });

  it('does not apply the full-width class by default', () => {
    expect(buttonEl().className).not.toContain('button--full-width');
  });

  it('applies the full-width class when fullWidth=true', () => {
    fixture.componentRef.setInput('fullWidth', true);
    fixture.detectChanges();

    expect(buttonEl().className).toContain('button--full-width');
  });

  it('renders as a native <button type="button">', () => {
    expect(buttonEl().tagName).toBe('BUTTON');
    expect(buttonEl().type).toBe('button');
  });

  it('is focusable and clickable via keyboard when enabled', () => {
    const clickSpy = jasmine.createSpy('clickSpy');

    buttonEl().addEventListener('click', clickSpy);

    buttonEl().focus();

    expect(document.activeElement).toBe(buttonEl());

    buttonEl().click();

    expect(clickSpy).toHaveBeenCalledWith(jasmine.any(MouseEvent));
  });

  it('blocks click and focus-driven activation when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const clickSpy = jasmine.createSpy('clickSpy');

    buttonEl().addEventListener('click', clickSpy);

    buttonEl().click();

    expect(clickSpy).not.toHaveBeenCalled();
    expect(buttonEl().disabled).toBe(true);
  });

  // SC-004: truncamento com reticências em 3 tamanhos de label — curto (cabe
  // com folga), no limite exato (largura do container == largura natural do
  // botão, sem nenhuma restrição extra) e excedente (container mais estreito
  // que o conteúdo). Altura MUST permanecer 48px nos 3 casos (SC-005).
  describe('label truncation (SC-004)', () => {
    it('does not truncate a short label with room to spare', () => {
      attachToDom(400);
      fixture.componentRef.setInput('label', 'Ok');
      fixture.detectChanges();

      expect(labelEl().scrollWidth).toBeLessThanOrEqual(labelEl().clientWidth);
      expect(buttonEl().offsetHeight).toBe(48);
    });

    it('fits exactly without truncating when the container imposes no extra constraint', () => {
      // Sem `attachToDom(largura)` nenhuma largura é imposta além da intrínseca
      // do próprio botão — "o limite exato do container" é, por definição, o
      // próprio tamanho do conteúdo, então nada deve truncar.
      attachToDom();
      fixture.detectChanges();

      expect(labelEl().scrollWidth).toBeLessThanOrEqual(labelEl().clientWidth);
      expect(buttonEl().offsetHeight).toBe(48);
    });

    it('truncates with an ellipsis when the container is narrower than the label — WITHOUT fullWidth', () => {
      // Acceptance Scenario 4 do spec exige isso mesmo sem `fullWidth` — só
      // funciona porque `.button` tem `max-width: 100%` (ver
      // button.component.scss), senão um inline-flex de tamanho intrínseco
      // simplesmente estouraria o container em vez de truncar.
      attachToDom(120);
      fixture.componentRef.setInput('label', 'Um label bem mais longo do que o espaço disponível para caber');
      fixture.detectChanges();

      expect(buttonEl().offsetWidth).toBeLessThanOrEqual(120);
      expect(labelEl().scrollWidth).toBeGreaterThan(labelEl().clientWidth);
      expect(getComputedStyle(labelEl()).textOverflow).toBe('ellipsis');
      expect(getComputedStyle(labelEl()).whiteSpace).toBe('nowrap');
      expect(buttonEl().offsetHeight).toBe(48);
    });
  });

  it('fullWidth resolves to the actual pixel width of the parent container, not the label', () => {
    attachToDom(400);
    fixture.componentRef.setInput('label', 'Ok');
    fixture.componentRef.setInput('fullWidth', true);
    fixture.detectChanges();

    expect(buttonEl().offsetWidth).toBe(400);
  });

  it('shows the design-system focus ring (comm-focus, 2px, 4px offset) when focus arrives via keyboard', () => {
    attachToDom();
    // Nenhum mousedown disparado antes — KeyboardFocusService assume teclado
    // por padrão (ver shared/services/keyboard-focus.service.ts).
    buttonEl().focus();
    fixture.detectChanges();

    const cs = getComputedStyle(buttonEl());

    expect(cs.outlineWidth).toBe('2px');
    expect(cs.outlineStyle).toBe('solid');
    expect(cs.outlineColor).toBe('rgb(255, 51, 187)'); // comm-focus #FF33BB
    expect(cs.outlineOffset).toBe('4px');
  });

  it('does NOT show the pink focus ring when focus arrives via mouse click', () => {
    attachToDom();
    // Simula o gesto real de clique (mousedown antes do foco) — é isso que
    // o KeyboardFocusService rastreia para decidir a modalidade.
    buttonEl().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    buttonEl().focus();
    fixture.detectChanges();

    const cs = getComputedStyle(buttonEl());

    expect(cs.outlineStyle).toBe('none');
  });
});
