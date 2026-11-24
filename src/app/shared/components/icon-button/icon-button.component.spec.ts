import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { IconButtonAppearance, IconButtonComponent, IconButtonKind, IconButtonSize } from './icon-button.component';

describe('IconButtonComponent', () => {
  let fixture: ComponentFixture<IconButtonComponent>;

  function buttonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  // Mesma justificativa de `button.component.spec.ts`: `:host { display: contents }`
  // exige anexar ao document real para offsetWidth/offsetHeight refletirem layout.
  let attachedContainer: HTMLElement | null = null;

  function attachToDom(): HTMLElement {
    const container = document.createElement('div');

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
      imports: [IconButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IconButtonComponent);
    fixture.componentRef.setInput('icon', 'arrow-left');
    fixture.componentRef.setInput('ariaLabel', 'Voltar');
    fixture.detectChanges();
  });

  it('renders the icon via ph-icon', () => {
    const icon = fixture.debugElement.query(By.directive(PhIconComponent));

    expect(icon).toBeTruthy();
    expect(icon.componentInstance.name()).toBe('arrow-left');
  });

  describe('peso do ícone (regular por padrão; bold só ativo ou desabilitado)', () => {
    function weight(): string {
      return fixture.debugElement.query(By.directive(PhIconComponent)).componentInstance.weight();
    }

    it('regular por padrão', () => {
      expect(weight()).toBe('regular');
    });

    it('fill (sólido) quando active, solid ou com aria-expanded=true; bold quando disabled', () => {
      fixture.componentRef.setInput('active', true);
      fixture.detectChanges();

      expect(weight()).toBe('fill');

      fixture.componentRef.setInput('active', false);
      fixture.componentRef.setInput('solid', true);
      fixture.detectChanges();

      expect(weight()).toBe('fill');
      fixture.componentRef.setInput('solid', false);

      fixture.componentRef.setInput('active', false);
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      expect(weight()).toBe('bold');

      fixture.componentRef.setInput('disabled', false);
      fixture.componentRef.setInput('ariaExpanded', true);
      fixture.detectChanges();

      expect(weight()).toBe('fill');
    });
  });

  it('exposes the aria-label since there is no visible text', () => {
    expect(buttonEl().getAttribute('aria-label')).toBe('Voltar');
  });

  it('defaults to kind=primary, appearance=solid, size=default', () => {
    const classes = buttonEl().className;

    expect(classes).toContain('icon-button--primary');
    expect(classes).toContain('icon-button--solid');
    expect(classes).toContain('icon-button--default');
  });

  const kinds: IconButtonKind[] = ['primary', 'secondary', 'tertiary'];
  const appearances: IconButtonAppearance[] = ['solid', 'outlined', 'icon'];
  const sizes: IconButtonSize[] = ['default', 'small'];

  for (const kind of kinds) {
    for (const appearance of appearances) {
      for (const size of sizes) {
        it(`applies the icon-button--${kind} icon-button--${appearance} icon-button--${size} classes`, () => {
          fixture.componentRef.setInput('kind', kind);
          fixture.componentRef.setInput('appearance', appearance);
          fixture.componentRef.setInput('size', size);
          fixture.detectChanges();

          const classes = buttonEl().className;

          expect(classes).toContain(`icon-button--${kind}`);
          expect(classes).toContain(`icon-button--${appearance}`);
          expect(classes).toContain(`icon-button--${size}`);
        });
      }
    }
  }

  it('renders a single, unified disabled appearance regardless of kind/appearance/size', () => {
    attachToDom();
    fixture.componentRef.setInput('kind', 'tertiary');
    fixture.componentRef.setInput('appearance', 'outlined');
    fixture.componentRef.setInput('size', 'small');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(buttonEl().disabled).toBe(true);

    // FR-005: aparência única (--color-state-disabled / --color-state-disabled-2),
    // travada como regressão em vez de só confiar no atributo `disabled` nativo.
    const cs = getComputedStyle(buttonEl());

    expect(cs.backgroundColor).toBe('rgb(215, 224, 228)'); // --color-state-disabled #D7E0E4
    expect(cs.color).toBe('rgb(102, 120, 128)'); // --color-state-disabled-2 #667880
    expect(cs.borderColor).toBe('rgba(0, 0, 0, 0)'); // v2: sem contorno visível no disabled
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

  // Figma v2/IconButton: size="default" = lg 48x48 e size="small" = md 40x40,
  // ambos com ícone de 24px.
  describe('size dimensions (SC-003)', () => {
    it('size="default" renders a 48x48 container with a 24px icon', () => {
      attachToDom();
      fixture.detectChanges();

      expect(buttonEl().offsetWidth).toBe(48);
      expect(buttonEl().offsetHeight).toBe(48);

      const icon = fixture.debugElement.query(By.directive(PhIconComponent));

      expect(icon.componentInstance.size()).toBe(24);
    });

    it('size="small" renders a 40x40 container with a 24px icon', () => {
      fixture.componentRef.setInput('size', 'small');
      attachToDom();
      fixture.detectChanges();

      expect(buttonEl().offsetWidth).toBe(40);
      expect(buttonEl().offsetHeight).toBe(40);

      const icon = fixture.debugElement.query(By.directive(PhIconComponent));

      expect(icon.componentInstance.size()).toBe(24);
    });
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
    expect(cs.outlineColor).toBe('rgb(222, 67, 220)'); // comm-focus #DE43DC
    expect(cs.outlineOffset).toBe('4px');
  });

  it('does NOT show the pink focus ring when focus arrives via mouse click', () => {
    attachToDom();
    buttonEl().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    buttonEl().focus();
    fixture.detectChanges();

    const cs = getComputedStyle(buttonEl());

    expect(cs.outlineStyle).toBe('none');
  });
});
