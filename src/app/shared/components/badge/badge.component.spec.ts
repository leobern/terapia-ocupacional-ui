import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { BadgeComponent } from './badge.component';

describe('BadgeComponent', () => {
  let fixture: ComponentFixture<BadgeComponent>;

  // O host É a caixa visual do badge (sem `display: contents`, ao contrário de
  // Button/IconButton — ver badge.component.ts) — as classes/estilos ficam no próprio
  // elemento `<app-badge>`, não num `<div>` interno.
  function badgeEl(): HTMLElement {
    return fixture.nativeElement;
  }

  // Anexar ao document real para offsetWidth/offsetHeight e getComputedStyle
  // refletirem layout (mesma justificativa de button/icon-button, embora aqui o host
  // já seja um elemento com caixa própria, não `display: contents`).
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
      imports: [BadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BadgeComponent);
    fixture.detectChanges();
  });

  it('defaults to type="numeral" with value=0', () => {
    expect(badgeEl().classList).toContain('badge--numeral');
    expect(badgeEl().textContent?.trim()).toBe('0');
  });

  describe('type="numeral" formatting (FR-002)', () => {
    const cases: [number, string][] = [
      [1, '1'],
      [999, '999'],
      [1000, '+999'],
      [9999, '+999'],
    ];

    for (const [value, expected] of cases) {
      it(`value=${value} renders "${expected}"`, () => {
        fixture.componentRef.setInput('value', value);
        fixture.detectChanges();

        const text = badgeEl().textContent?.trim() ?? '';

        expect(text).toBe(expected);
        expect(text.length).toBeLessThanOrEqual(4);
      });
    }
  });

  it('type="numeral" always uses fixed background/text colors, regardless of type switching', () => {
    attachToDom();
    fixture.detectChanges();

    const cs = getComputedStyle(badgeEl());

    expect(cs.backgroundColor).toBe('rgb(0, 170, 255)'); // --color-secondary #00AAFF
    expect(cs.borderRadius).toBe('400px'); // --radius-pill
    const label = badgeEl().querySelector('.badge__label') as HTMLElement;

    expect(getComputedStyle(label).color).toBe('rgb(255, 255, 255)'); // --color-content-6
  });

  describe('type="icon"', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('type', 'icon');
      fixture.componentRef.setInput('icon', 'check');
      fixture.detectChanges();
    });

    it('renders the icon via ph-icon at 12px', () => {
      const icon = fixture.debugElement.query(By.directive(PhIconComponent));

      expect(icon).toBeTruthy();
      expect(icon.componentInstance.name()).toBe('check');
      expect(icon.componentInstance.size()).toBe(12);
    });

    // FR-006/SC-001 (T013 — converge): faltava cobertura de dimensão/radius para
    // este type, só existia para "numeral".
    it('renders a 24x24 container with border-radius: var(--radius-pill) (FR-006)', () => {
      attachToDom();
      fixture.detectChanges();

      expect(badgeEl().offsetWidth).toBe(24);
      expect(badgeEl().offsetHeight).toBe(24);
      expect(getComputedStyle(badgeEl()).borderRadius).toBe('400px');
    });

    it('applies a custom backgroundColor/iconColor via inline style', () => {
      fixture.componentRef.setInput('backgroundColor', '#abcdef');
      fixture.componentRef.setInput('iconColor', '#123456');
      fixture.detectChanges();

      expect(getComputedStyle(badgeEl()).backgroundColor).toBe('rgb(171, 205, 239)');

      const icon = fixture.debugElement.query(By.directive(PhIconComponent)).nativeElement as HTMLElement;

      expect(getComputedStyle(icon).color).toBe('rgb(18, 52, 86)');
    });
  });

  describe('type="color"', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('type', 'color');
      fixture.detectChanges();
    });

    it('renders an 8x8 indicator with no inner content', () => {
      attachToDom();
      fixture.detectChanges();

      expect(badgeEl().classList).toContain('badge--color');
      expect(badgeEl().offsetWidth).toBe(8);
      expect(badgeEl().offsetHeight).toBe(8);
      expect(badgeEl().children.length).toBe(0);
    });

    // FR-006/SC-001 (T013 — converge): faltava a asserção de radius para este type
    // (a dimensão 8x8 já estava coberta acima).
    it('has border-radius: var(--radius-pill) (FR-006)', () => {
      attachToDom();
      fixture.detectChanges();

      expect(getComputedStyle(badgeEl()).borderRadius).toBe('400px');
    });

    it('applies a custom color via inline style', () => {
      fixture.componentRef.setInput('color', '#ff00ff');
      fixture.detectChanges();

      expect(getComputedStyle(badgeEl()).backgroundColor).toBe('rgb(255, 0, 255)');
    });
  });

  it('is never focusable or interactive (SC-004)', () => {
    for (const type of ['numeral', 'icon', 'color'] as const) {
      fixture.componentRef.setInput('type', type);
      fixture.detectChanges();

      expect(badgeEl().hasAttribute('tabindex')).toBeFalse();
      expect(badgeEl().getAttribute('role')).not.toBe('button');
      expect(badgeEl().tagName).not.toBe('BUTTON');
    }
  });
});
