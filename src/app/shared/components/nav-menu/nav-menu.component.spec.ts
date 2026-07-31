import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { NavMenuComponent, NavMenuItemKey } from './nav-menu.component';

describe('NavMenuComponent', () => {
  let fixture: ComponentFixture<NavMenuComponent>;

  function navLinks(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.nav-menu__links .nav-menu__link'));
  }

  function logoutButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.nav-menu__link--logout');
  }

  function linkByLabel(label: string): HTMLButtonElement {
    const link = navLinks().find(el => el.textContent?.includes(label));

    if (!link) {
      throw new Error(`Link "${label}" não encontrado`);
    }

    return link;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NavMenuComponent);
    fixture.detectChanges();
  });

  it('renders the 5 navigation items with the expected icons, all in "regular" weight and 24px', () => {
    const expected: { label: string; icon: string }[] = [
      { icon: 'hospital', label: 'Hospitais' },
      { icon: 'pill', label: 'Farmácia' },
      { icon: 'users-four', label: 'Pacientes' },
      { icon: 'squares-four', label: 'Ações da tela' },
      { icon: 'bell', label: 'Notificações' },
    ];

    const links = navLinks();

    expect(links.length).toBe(5);

    expected.forEach(({ label, icon }) => {
      const link = linkByLabel(label);
      const iconDebugEl = fixture.debugElement
        .queryAll(By.directive(PhIconComponent))
        .find(el => el.nativeElement === link.querySelector('ph-icon'));

      expect(iconDebugEl?.componentInstance.name()).toBe(icon);
      expect(iconDebugEl?.componentInstance.weight()).toBe('regular');
      expect(iconDebugEl?.componentInstance.size()).toBe(24);
    });
  });

  it('renders the logout item with the power icon in "regular" weight and 24px', () => {
    const icon = logoutButton().querySelector('ph-icon');
    const iconDebugEl = fixture.debugElement
      .queryAll(By.directive(PhIconComponent))
      .find(el => el.nativeElement === icon);

    expect(logoutButton().textContent).toContain('Sair');
    expect(iconDebugEl?.componentInstance.name()).toBe('power');
    expect(iconDebugEl?.componentInstance.weight()).toBe('regular');
    expect(iconDebugEl?.componentInstance.size()).toBe(24);
  });

  it('wraps the 5 navigation items in a <nav aria-label="Navegação principal">, excluding logout', () => {
    const nav = fixture.nativeElement.querySelector('nav.nav-menu__links');

    expect(nav.getAttribute('aria-label')).toBe('Navegação principal');
    expect(nav.contains(logoutButton())).toBe(false);
  });

  const clickCases: { label: string; output: keyof NavMenuComponent }[] = [
    { label: 'Hospitais', output: 'hospitaisClick' },
    { label: 'Farmácia', output: 'farmaciaClick' },
    { label: 'Pacientes', output: 'pacientesClick' },
    { label: 'Ações da tela', output: 'acoesTelaClick' },
    { label: 'Notificações', output: 'notificacoesClick' },
  ];

  for (const { label, output } of clickCases) {
    it(`emits ${output} when "${label}" is clicked`, () => {
      const clickHandler = jasmine.createSpy('clickHandler');

      (fixture.componentInstance[output] as { subscribe: (fn: () => void) => void }).subscribe(clickHandler);
      linkByLabel(label).click();

      expect(clickHandler).toHaveBeenCalledWith(undefined);
    });
  }

  it('emits logoutClick when "Sair" is clicked', () => {
    const logoutClick = jasmine.createSpy('logoutClick');

    fixture.componentInstance.logoutClick.subscribe(logoutClick);
    logoutButton().click();

    expect(logoutClick).toHaveBeenCalledWith(undefined);
  });

  it('does not mark any item as active when activeItem is null (default)', () => {
    for (const link of navLinks()) {
      expect(link.className).not.toContain('nav-menu__link--active');
    }
  });

  const activeCases: NavMenuItemKey[] = ['hospitais', 'farmacia', 'pacientes', 'acoes-tela', 'notificacoes'];

  for (const key of activeCases) {
    it(`marks only the "${key}" item as active when activeItem is set to it`, () => {
      fixture.componentRef.setInput('activeItem', key);
      fixture.detectChanges();

      const activeLinks = navLinks().filter(el => el.className.includes('nav-menu__link--active'));

      expect(activeLinks.length).toBe(1);
    });
  }

  describe('systemic keyboard focus ring', () => {
    it('applies the keyboard-focus class when a link receives focus via keyboard', () => {
      const link = linkByLabel('Pacientes');

      link.focus();
      link.dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();

      expect(link.className).toContain('keyboard-focus');
    });

    it('does not apply the keyboard-focus class when focus arrives via mouse', () => {
      const link = linkByLabel('Pacientes');

      link.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      link.focus();
      link.dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();

      expect(link.className).not.toContain('keyboard-focus');
    });

    it('removes the keyboard-focus class on blur', () => {
      const link = linkByLabel('Pacientes');

      link.focus();
      link.dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();

      expect(link.className).toContain('keyboard-focus');

      link.dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();

      expect(link.className).not.toContain('keyboard-focus');
    });
  });
});
