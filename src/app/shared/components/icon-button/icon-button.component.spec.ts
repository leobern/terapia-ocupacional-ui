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

    expect(cs.backgroundColor).toBe('rgb(199, 204, 209)'); // --color-state-disabled #C7CCD1
    expect(cs.color).toBe('rgb(78, 88, 95)'); // --color-state-disabled-2 #4E585F
    expect(cs.borderStyle).toBe('none');
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

  // SC-003: size="default" produz 48x48 (ícone 32 + padding 8 nos dois lados);
  // size="small" produz 32x32 (ícone 16 + padding 8 nos dois lados).
  describe('size dimensions (SC-003)', () => {
    it('size="default" renders a 48x48 container with a 32px icon', () => {
      attachToDom();
      fixture.detectChanges();

      expect(buttonEl().offsetWidth).toBe(48);
      expect(buttonEl().offsetHeight).toBe(48);

      const icon = fixture.debugElement.query(By.directive(PhIconComponent));

      expect(icon.componentInstance.size()).toBe(32);
    });

    it('size="small" renders a 32x32 container with a 16px icon', () => {
      fixture.componentRef.setInput('size', 'small');
      attachToDom();
      fixture.detectChanges();

      expect(buttonEl().offsetWidth).toBe(32);
      expect(buttonEl().offsetHeight).toBe(32);

      const icon = fixture.debugElement.query(By.directive(PhIconComponent));

      expect(icon.componentInstance.size()).toBe(16);
    });
  });

  it('shows the design-system focus ring (comm-focus, 2px, 4px offset) on :focus-visible', () => {
    attachToDom();
    buttonEl().focus();
    fixture.detectChanges();

    // Mesma heurística já documentada em button.component.spec.ts: `.focus()`
    // programático sem interação de mouse prévia é tratado como navegação por
    // teclado pelo Chrome.
    expect(buttonEl().matches(':focus-visible')).toBeTrue();

    const cs = getComputedStyle(buttonEl());

    expect(cs.outlineWidth).toBe('2px');
    expect(cs.outlineStyle).toBe('solid');
    expect(cs.outlineColor).toBe('rgb(255, 51, 187)'); // comm-focus #FF33BB
    expect(cs.outlineOffset).toBe('4px');
  });
});
