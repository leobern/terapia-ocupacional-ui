import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { InputSelectComponent } from './input-select.component';

describe('InputSelectComponent', () => {
  let fixture: ComponentFixture<InputSelectComponent>;

  function containerEl(): HTMLElement {
    return fixture.nativeElement.querySelector('.input-select');
  }

  function fieldEl(): HTMLElement {
    return fixture.nativeElement.querySelector('.input-select__field');
  }

  function clearEl(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.input-select__clear');
  }

  // Mesmo motivo do Button: getBoundingClientRect/getComputedStyle só refletem
  // layout real com o elemento anexado ao documento vivo.
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
      imports: [InputSelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InputSelectComponent);
    fixture.detectChanges();
  });

  // --- User Story 1: shell + variantes + Default/Filled ---------------------

  describe('US1 — shell e variantes', () => {
    it('defaults to variant=text, rendering a native <input type="text">', () => {
      expect(fieldEl().tagName).toBe('INPUT');
      expect((fieldEl() as HTMLInputElement).type).toBe('text');
    });

    it('renders a role="combobox" trigger (never an <input readonly>) for variant=select', () => {
      fixture.componentRef.setInput('variant', 'select');
      fixture.detectChanges();

      expect(fieldEl().tagName).not.toBe('INPUT');
      expect(fieldEl().getAttribute('role')).toBe('combobox');
      expect(fieldEl().getAttribute('aria-haspopup')).toBe('listbox');
      expect(fieldEl().hasAttribute('aria-expanded')).toBeTrue();
    });

    it('shows the placeholder when value is empty', () => {
      fixture.componentRef.setInput('placeholder', 'Insira seu e-mail');
      fixture.detectChanges();

      expect((fieldEl() as HTMLInputElement).placeholder).toBe('Insira seu e-mail');
      expect(fieldEl().className).not.toContain('input-select__field--filled');
    });

    it('applies the filled modifier when value is non-empty', () => {
      fixture.componentRef.setInput('value', 'thiago.angelito@gmail.com');
      fixture.detectChanges();

      expect(fieldEl().className).toContain('input-select__field--filled');
      expect((fieldEl() as HTMLInputElement).value).toBe('thiago.angelito@gmail.com');
    });

    it('emits valueChange with the native input value on user typing', () => {
      const valueChangeSpy = jasmine.createSpy('valueChangeSpy');

      fixture.componentInstance.valueChange.subscribe(valueChangeSpy);

      const input = fieldEl() as HTMLInputElement;

      input.value = 'novo@email.com';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      expect(valueChangeSpy).toHaveBeenCalledWith('novo@email.com');
    });

    it('always renders the caret-down trailing icon for variant=select, regardless of value', () => {
      fixture.componentRef.setInput('variant', 'select');
      fixture.detectChanges();

      let icons = fixture.debugElement.queryAll(By.directive(PhIconComponent));

      expect(icons[icons.length - 1].componentInstance.name()).toBe('caret-down');

      fixture.componentRef.setInput('value', 'Hospital A');
      fixture.detectChanges();
      icons = fixture.debugElement.queryAll(By.directive(PhIconComponent));

      expect(icons[icons.length - 1].componentInstance.name()).toBe('caret-down');
    });

    it('does not render a trailing icon for variant=text when trailingIcon is not provided', () => {
      expect(fixture.nativeElement.querySelector('ph-icon')).toBeNull();
    });

    it('renders iconLeft and a provided trailingIcon for variant=text', () => {
      fixture.componentRef.setInput('iconLeft', 'envelope-simple');
      fixture.componentRef.setInput('trailingIcon', 'warning-circle');
      fixture.detectChanges();

      const icons = fixture.debugElement.queryAll(By.directive(PhIconComponent));

      expect(icons.length).toBe(2);
      expect(icons[0].componentInstance.name()).toBe('envelope-simple');
      expect(icons[1].componentInstance.name()).toBe('warning-circle');
    });

    describe('truncamento com ellipsis (SC-003)', () => {
      it('does not truncate a short value with room to spare', () => {
        attachToDom(400);
        fixture.componentRef.setInput('value', 'Ok');
        fixture.detectChanges();

        expect(fieldEl().scrollWidth).toBeLessThanOrEqual(fieldEl().clientWidth);
        expect(containerEl().offsetHeight).toBe(48);
      });

      it('fits exactly without truncating when the container imposes no extra constraint', () => {
        attachToDom();
        fixture.detectChanges();

        expect(fieldEl().scrollWidth).toBeLessThanOrEqual(fieldEl().clientWidth);
        expect(containerEl().offsetHeight).toBe(48);
      });

      it('truncates with an ellipsis when the container is narrower than the value', () => {
        attachToDom(150);
        fixture.componentRef.setInput('value', 'um.email.bem.mais.longo.do.que.o.espaco.disponivel@example.com');
        fixture.detectChanges();

        expect(getComputedStyle(fieldEl()).textOverflow).toBe('ellipsis');
        expect(getComputedStyle(fieldEl()).whiteSpace).toBe('nowrap');
        expect(containerEl().offsetHeight).toBe(48);
      });
    });
  });

  // --- User Story 2: gatilho do overlay do Select ----------------------------

  describe('US2 — gatilho do Select', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('variant', 'select');
      fixture.detectChanges();
    });

    it('emits selectTrigger on click and never activates a text cursor', () => {
      const selectTriggerSpy = jasmine.createSpy('selectTriggerSpy');

      fixture.componentInstance.selectTrigger.subscribe(selectTriggerSpy);
      fieldEl().click();

      expect(selectTriggerSpy).toHaveBeenCalledWith(undefined);
      expect(fieldEl().tagName).not.toBe('INPUT');
    });

    it('emits selectTrigger on Enter and Space when focused', () => {
      const selectTriggerSpy = jasmine.createSpy('selectTriggerSpy');

      fixture.componentInstance.selectTrigger.subscribe(selectTriggerSpy);
      fieldEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fieldEl().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

      expect(selectTriggerSpy).toHaveBeenCalledTimes(2);
    });

    it('does not emit selectTrigger when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const selectTriggerSpy = jasmine.createSpy('selectTriggerSpy');

      fixture.componentInstance.selectTrigger.subscribe(selectTriggerSpy);
      fieldEl().click();

      expect(selectTriggerSpy).not.toHaveBeenCalled();
      expect(fieldEl().getAttribute('tabindex')).toBe('-1');
    });

    it('does not emit selectTrigger on Enter/Space when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const selectTriggerSpy = jasmine.createSpy('selectTriggerSpy');

      fixture.componentInstance.selectTrigger.subscribe(selectTriggerSpy);
      fieldEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(selectTriggerSpy).not.toHaveBeenCalled();
    });

    it('is focusable via Tab (tabindex=0) when enabled', () => {
      expect(fieldEl().getAttribute('tabindex')).toBe('0');
    });
  });

  describe('US2 — variant=text nunca aciona selectTrigger', () => {
    it('focuses the native input on click/focus without emitting selectTrigger', () => {
      const selectTriggerSpy = jasmine.createSpy('selectTriggerSpy');

      fixture.componentInstance.selectTrigger.subscribe(selectTriggerSpy);
      attachToDom();
      (fieldEl() as HTMLInputElement).focus();

      expect(document.activeElement).toBe(fieldEl());
      expect(selectTriggerSpy).not.toHaveBeenCalled();
    });
  });

  // --- User Story 3: Focus, clear e anel de foco duplo -----------------------

  describe('US3 — foco, clear e anéis de foco', () => {
    it('shows the border-color and box-shadow ring on focus, without changing border-width (SC-008)', () => {
      attachToDom();

      const before = containerEl().getBoundingClientRect();

      (fieldEl() as HTMLInputElement).focus();
      fixture.detectChanges();

      const after = containerEl().getBoundingClientRect();
      const cs = getComputedStyle(containerEl());

      expect(cs.borderColor).toBe('rgb(0, 34, 51)'); // content-1 #002233
      expect(cs.boxShadow).toContain('rgba(0, 34, 51, 0.4)');
      expect(cs.borderTopWidth).toBe('1px');
      expect(before.width).toBe(after.width);
      expect(before.height).toBe(after.height);
    });

    it('also applies the systemic pink focus-visible ring alongside the box-shadow (accessibility decision)', () => {
      attachToDom();
      (fieldEl() as HTMLInputElement).focus();
      fixture.detectChanges();

      // Ambiente de teste: `.focus()` programático sem interação de mouse
      // prévia é tratado como navegação por teclado pela heurística do
      // Chrome — mesma premissa já usada no teste equivalente do Button.
      expect(fieldEl().matches(':focus-visible')).toBeTrue();

      const cs = getComputedStyle(containerEl());

      expect(cs.outlineWidth).toBe('2px');
      expect(cs.outlineColor).toBe('rgb(255, 51, 187)'); // comm-focus #FF33BB
      expect(cs.outlineOffset).toBe('4px');
    });

    it('does not show the clear icon by default (unfocused, empty)', () => {
      expect(clearEl()).toBeNull();
    });

    it('does not show the clear icon when focused but value is empty', () => {
      attachToDom();
      (fieldEl() as HTMLInputElement).focus();
      fixture.detectChanges();

      expect(clearEl()).toBeNull();
    });

    it('does not show the clear icon when value is filled but unfocused', () => {
      fixture.componentRef.setInput('value', 'thiago.angelito@gmail.com');
      fixture.detectChanges();

      expect(clearEl()).toBeNull();
    });

    it('shows the clear icon only when focused AND value is non-empty, and hides it again on blur', () => {
      attachToDom();
      fixture.componentRef.setInput('value', 'thiago.angelito@gmail.com');
      fixture.detectChanges();
      (fieldEl() as HTMLInputElement).focus();
      fixture.detectChanges();

      expect(clearEl()).not.toBeNull();

      (fieldEl() as HTMLInputElement).blur();
      fixture.detectChanges();

      expect(clearEl()).toBeNull();
    });

    it('clicking the clear icon resets value and keeps focus', () => {
      attachToDom();
      fixture.componentRef.setInput('value', 'thiago.angelito@gmail.com');
      fixture.detectChanges();
      (fieldEl() as HTMLInputElement).focus();
      fixture.detectChanges();

      const valueChangeSpy = jasmine.createSpy('valueChangeSpy');

      fixture.componentInstance.valueChange.subscribe(valueChangeSpy);
      clearEl()?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      clearEl()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(valueChangeSpy).toHaveBeenCalledWith('');
      expect(document.activeElement).toBe(fieldEl());
    });
  });
});
