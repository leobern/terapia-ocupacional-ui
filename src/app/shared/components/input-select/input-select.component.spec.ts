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
    // `placeholder` é obrigatório (input.required) — precisa de um valor antes
    // do primeiro `detectChanges()`, senão o Angular lança em runtime.
    fixture.componentRef.setInput('placeholder', 'Placeholder de teste');
    fixture.detectChanges();
  });

  // --- Acessibilidade (Princípio X) -----------------------------------------

  describe('nome acessível e contrato do combobox', () => {
    it('nomeia o <input> pelo placeholder quando não há ariaLabel explícito', () => {
      fixture.componentRef.setInput('placeholder', 'Insira seu e-mail');
      fixture.detectChanges();

      expect(fieldEl().getAttribute('aria-label')).toBe('Insira seu e-mail');
    });

    it('mantém o nome acessível mesmo com o placeholder visual apagado pelo foco', () => {
      fixture.componentRef.setInput('placeholder', 'Insira seu e-mail');
      fieldEl().dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();

      // O placeholder some ao focar (por decisão de produto) — é exatamente o
      // momento em que o campo ficaria anônimo sem o aria-label.
      expect((fieldEl() as HTMLInputElement).placeholder).toBe('');
      expect(fieldEl().getAttribute('aria-label')).toBe('Insira seu e-mail');
    });

    it('ariaLabel explícito tem precedência sobre o placeholder', () => {
      fixture.componentRef.setInput('ariaLabel', 'E-mail do responsável');
      fixture.detectChanges();

      expect(fieldEl().getAttribute('aria-label')).toBe('E-mail do responsável');
    });

    it('o combobox reflete o estado real do overlay do consumidor', () => {
      fixture.componentRef.setInput('variant', 'select');
      fixture.detectChanges();

      expect(fieldEl().getAttribute('aria-expanded')).toBe('false');
      expect(fieldEl().hasAttribute('aria-controls')).toBeFalse();

      fixture.componentRef.setInput('expanded', true);
      fixture.componentRef.setInput('controlsId', 'lista-hospitais');
      fixture.componentRef.setInput('activeDescendantId', 'hospital-3');
      fixture.detectChanges();

      expect(fieldEl().getAttribute('aria-expanded')).toBe('true');
      expect(fieldEl().getAttribute('aria-controls')).toBe('lista-hospitais');
      expect(fieldEl().getAttribute('aria-activedescendant')).toBe('hospital-3');
    });
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
      expect(cs.boxShadow).toContain('rgba(0, 34, 51, 0.6)');
      expect(cs.borderTopWidth).toBe('1px');
      expect(before.width).toBe(after.width);
      expect(before.height).toBe(after.height);
    });

    it('also applies the systemic pink ring alongside the box-shadow when focus arrives via keyboard', () => {
      attachToDom();
      // Nenhum mousedown disparado antes — KeyboardFocusService assume
      // teclado por padrão (shared/services/keyboard-focus.service.ts).
      (fieldEl() as HTMLInputElement).focus();
      fixture.detectChanges();

      const cs = getComputedStyle(containerEl());

      expect(cs.outlineWidth).toBe('2px');
      expect(cs.outlineColor).toBe('rgb(255, 51, 187)'); // comm-focus #FF33BB
      expect(cs.outlineOffset).toBe('4px');
    });

    it('does NOT show the pink ring when focus arrives via mouse click, but keeps the box-shadow', () => {
      attachToDom();
      fieldEl().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      (fieldEl() as HTMLInputElement).focus();
      fixture.detectChanges();

      const cs = getComputedStyle(containerEl());

      expect(cs.outlineStyle).toBe('none');
      expect(cs.borderColor).toBe('rgb(0, 34, 51)');
      expect(cs.boxShadow).toContain('rgba(0, 34, 51, 0.6)');
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

    it('also shows the clear icon for variant=select when focused and filled', () => {
      attachToDom();
      fixture.componentRef.setInput('variant', 'select');
      fixture.componentRef.setInput('value', 'Hospital A');
      fixture.detectChanges();
      fieldEl().dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      expect(clearEl()).not.toBeNull();
    });

    it('uses content-5 for the trailing icon color (not the dynamic text color)', () => {
      fixture.componentRef.setInput('trailingIcon', 'warning-circle');
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('.input-select__icon--trailing');

      expect(getComputedStyle(icon).color).toBe('rgb(148, 172, 184)'); // content-5 #94ACB8
    });

    it('uses content-1 for the leading icon color, always (not the dynamic text color)', () => {
      fixture.componentRef.setInput('iconLeft', 'envelope-simple');
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('.input-select__icon--leading');

      expect(getComputedStyle(icon).color).toBe('rgb(0, 34, 51)'); // content-1 #002233

      fixture.componentRef.setInput('value', 'thiago.angelito@gmail.com');
      fixture.detectChanges();

      expect(getComputedStyle(icon).color).toBe('rgb(0, 34, 51)'); // permanece content-1 em Filled
    });

    it('overrides the leading and trailing icon colors to state-disabled-2 when disabled (never leaks content-1/content-5)', () => {
      fixture.componentRef.setInput('iconLeft', 'envelope-simple');
      fixture.componentRef.setInput('trailingIcon', 'warning-circle');
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const leading = fixture.nativeElement.querySelector('.input-select__icon--leading');
      const trailing = fixture.nativeElement.querySelector('.input-select__icon--trailing');

      expect(getComputedStyle(leading).color).toBe('rgb(78, 88, 95)'); // state-disabled-2 #4E585F
      expect(getComputedStyle(trailing).color).toBe('rgb(78, 88, 95)');
    });

    it('uses content-3 for the clear icon color', () => {
      attachToDom();
      fixture.componentRef.setInput('value', 'thiago.angelito@gmail.com');
      fixture.detectChanges();
      (fieldEl() as HTMLInputElement).focus();
      fixture.detectChanges();

      expect(getComputedStyle(clearEl() as HTMLElement).color).toBe('rgb(33, 131, 131)'); // content-3 #218383
    });
  });

  describe('US3 — placeholder some ao focar', () => {
    it('shows the placeholder when unfocused and empty', () => {
      fixture.componentRef.setInput('placeholder', 'Insira seu e-mail');
      fixture.detectChanges();

      expect((fieldEl() as HTMLInputElement).placeholder).toBe('Insira seu e-mail');
    });

    it('hides the placeholder as soon as the field is focused, even before typing', () => {
      attachToDom();
      fixture.componentRef.setInput('placeholder', 'Insira seu e-mail');
      fixture.detectChanges();
      (fieldEl() as HTMLInputElement).focus();
      fixture.detectChanges();

      expect((fieldEl() as HTMLInputElement).placeholder).toBe('');
    });

    it('shows the placeholder again on blur when the field remains empty', () => {
      attachToDom();
      fixture.componentRef.setInput('placeholder', 'Insira seu e-mail');
      fixture.detectChanges();
      (fieldEl() as HTMLInputElement).focus();
      fixture.detectChanges();
      (fieldEl() as HTMLInputElement).blur();
      fixture.detectChanges();

      expect((fieldEl() as HTMLInputElement).placeholder).toBe('Insira seu e-mail');
    });

    it('hides the placeholder text for variant=select while focused and empty', () => {
      attachToDom();
      fixture.componentRef.setInput('variant', 'select');
      fixture.componentRef.setInput('placeholder', 'Selecione o hospital');
      fixture.detectChanges();

      expect(fieldEl().textContent?.trim()).toBe('Selecione o hospital');

      fieldEl().dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      expect(fieldEl().textContent?.trim()).toBe('');
    });
  });
});
