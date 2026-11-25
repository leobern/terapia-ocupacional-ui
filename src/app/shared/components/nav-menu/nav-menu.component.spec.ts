import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { ViewportBreakpointService } from '../../services/viewport-breakpoint.service';
import { IconButtonComponent } from '../icon-button/icon-button.component';
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

  it('renders the 4 navigation items with the expected icons, all in "regular" weight and 24px', () => {
    const expected: { label: string; icon: string }[] = [
      { icon: 'house', label: 'Home' },
      { icon: 'users-three', label: 'Pacientes' },
      { icon: 'hospital', label: 'Hospitais' },
      { icon: 'pill', label: 'Farmácia' },
      { icon: 'graduation-cap', label: 'Tutorial' },
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

  it('renders the logout item with the power icon always in "bold" weight and 24px', () => {
    const icon = logoutButton().querySelector('ph-icon');
    const iconDebugEl = fixture.debugElement
      .queryAll(By.directive(PhIconComponent))
      .find(el => el.nativeElement === icon);

    expect(logoutButton().textContent).toContain('Sair');
    expect(iconDebugEl?.componentInstance.name()).toBe('power');
    expect(iconDebugEl?.componentInstance.weight()).toBe('bold');
    expect(iconDebugEl?.componentInstance.size()).toBe(24);
  });

  it('wraps the 5 navigation items in a <nav aria-label="Navegação principal">, excluding logout', () => {
    const nav = fixture.nativeElement.querySelector('nav.nav-menu__links');

    expect(nav.getAttribute('aria-label')).toBe('Navegação principal');
    expect(nav.contains(logoutButton())).toBe(false);
  });

  const clickCases: { label: string; output: keyof NavMenuComponent }[] = [
    { label: 'Home', output: 'homeClick' },
    { label: 'Farmácia', output: 'farmaciaClick' },
    { label: 'Pacientes', output: 'pacientesClick' },
    { label: 'Hospitais', output: 'vinculosClick' },
    { label: 'Tutorial', output: 'tutorialClick' },
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

  describe('recolher depois do clique (desktop)', () => {
    const setDesktop = (value: boolean): void => {
      (TestBed.inject(ViewportBreakpointService) as { isDesktop: unknown }).isDesktop = (): boolean => value;
    };

    beforeEach(() => {
      setDesktop(true);
    });

    it('suprime o hover após clicar num item e volta quando o mouse sai do trilho', () => {
      const host = fixture.nativeElement as HTMLElement;

      linkByLabel('Home').click();
      fixture.detectChanges();

      expect(host.classList).toContain('nav-menu--suppressed');

      // mouse ainda dentro do trilho (aqui o host é `display: contents`, sem largura: borda direita = 0)
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }));
      fixture.detectChanges();

      expect(host.classList).toContain('nav-menu--suppressed');

      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000 }));
      fixture.detectChanges();

      expect(host.classList).not.toContain('nav-menu--suppressed');
    });

    it('não recolhe no mobile/tablet (menu controlado pelo consumidor)', () => {
      setDesktop(false);
      linkByLabel('Home').click();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).classList).not.toContain('nav-menu--suppressed');
    });
  });

  it('does not mark any item as active when activeItem is null (default)', () => {
    for (const link of navLinks()) {
      expect(link.className).not.toContain('nav-menu__link--active');
    }
  });

  const activeCases: NavMenuItemKey[] = ['home', 'farmacia', 'pacientes', 'tutorial'];

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

  describe('peso dos ícones (Phosphor regular/bold)', () => {
    function weightOf(label: string): string {
      const el = fixture.debugElement
        .queryAll(By.directive(PhIconComponent))
        .find(d => d.nativeElement === linkByLabel(label).querySelector('ph-icon'));

      return el?.componentInstance.weight();
    }

    it('usa fill (sólido) só no item ativo', () => {
      fixture.componentRef.setInput('activeItem', 'home');
      fixture.detectChanges();

      expect(weightOf('Home')).toBe('fill');
      expect(weightOf('Pacientes')).toBe('regular');
    });
  });

  describe('alternador de tema', () => {
    afterEach(() => {
      localStorage.removeItem('conductia-theme');
      document.documentElement.removeAttribute('data-theme');
    });

    function themeButtons(): HTMLButtonElement[] {
      return Array.from(fixture.nativeElement.querySelectorAll('.nav-menu__theme-button'));
    }

    it('mostra sol e lua, com o claro ativo por padrão', () => {
      const [light, dark] = themeButtons();

      expect(light.getAttribute('aria-pressed')).toBe('true');
      expect(dark.getAttribute('aria-pressed')).toBe('false');
    });

    it('troca para o tema escuro ao clicar na lua', () => {
      themeButtons()[1].click();
      fixture.detectChanges();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(themeButtons()[1].getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('painel mobile (open/closed)', () => {
    it('shows the close button when not on desktop (default jsdom width, <1200px)', () => {
      const closeButton = fixture.nativeElement.querySelector('.nav-menu__close');

      expect(closeButton).toBeTruthy();
    });

    it('uses the same secondary small "X" as the bottom-sheet close button', () => {
      const closeButton = fixture.debugElement.query(By.css('.nav-menu__close app-icon-button'))
        .componentInstance as IconButtonComponent;

      expect(closeButton.kind()).toBe('secondary');
      expect(closeButton.size()).toBe('small');
      expect(closeButton.icon()).toBe('x');
    });

    it('lists Home as the first navigation item', () => {
      expect(navLinks()[0].textContent).toContain('Home');
    });

    it('tocar no fundo escurecido fecha o menu', () => {
      let closed = 0;

      fixture.componentInstance.closed.subscribe(() => closed++);
      fixture.nativeElement.querySelector('.nav-menu__scrim').click();

      expect(closed).toBe(1);
    });

    describe('arrastar o menu para a esquerda (mobile)', () => {
      const touch = (x: number, y: number): Touch =>
        new Touch({ clientX: x, clientY: y, identifier: 1, target: fixture.nativeElement as HTMLElement });
      const swipe = (from: [number, number], to: [number, number]): void => {
        const panel = fixture.nativeElement.querySelector('.nav-menu__panel') as HTMLElement;

        panel.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(...from)] }));
        panel.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(...to)] }));
      };
      let closed: number;

      beforeEach(() => {
        closed = 0;
        fixture.componentRef.setInput('open', true);
        fixture.detectChanges();
        fixture.componentInstance.closed.subscribe(() => closed++);
      });

      it('um arrasto longo e horizontal fecha', () => {
        swipe([200, 300], [100, 310]);

        expect(closed).toBe(1);
      });

      it('arrasto curto, vertical ou para a direita não fecha', () => {
        swipe([200, 300], [170, 300]);
        swipe([200, 300], [120, 500]);
        swipe([100, 300], [260, 300]);

        expect(closed).toBe(0);
      });

      it('com o menu fechado ou sem começo de toque não fecha', () => {
        const panel = fixture.nativeElement.querySelector('.nav-menu__panel') as HTMLElement;

        panel.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(0, 0)] }));
        fixture.componentRef.setInput('open', false);
        fixture.detectChanges();
        swipe([200, 300], [100, 300]);

        expect(closed).toBe(0);
      });
    });

    it('applies the nav-menu--open host class when open is true', () => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();

      expect(fixture.nativeElement.classList).toContain('nav-menu--open');
    });

    it('does not apply the nav-menu--open host class when open is false (default)', () => {
      expect(fixture.nativeElement.classList).not.toContain('nav-menu--open');
    });

    it('emits closed when the close button is clicked', () => {
      const closed = jasmine.createSpy('closed');

      fixture.componentInstance.closed.subscribe(closed);
      (fixture.nativeElement.querySelector('.nav-menu__close button') as HTMLButtonElement).click();

      expect(closed).toHaveBeenCalledWith(undefined);
    });
  });

  it('emits logoClick when the logo is clicked (abre o assistente de IA)', () => {
    const logoClick = jasmine.createSpy('logoClick');

    fixture.componentInstance.logoClick.subscribe(logoClick);
    (fixture.nativeElement.querySelector('.nav-menu__logo-badge button') as HTMLButtonElement).click();

    expect(logoClick).toHaveBeenCalledWith(undefined);
  });
});
