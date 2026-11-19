import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterModule, Routes } from '@angular/router';

import { AppComponent } from './app.component';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

interface WritableLike<T> {
  (): T;
  set(value: T): void;
}

const ROUTES: Routes = [
  { component: DummyComponent, data: { hideShell: true }, path: 'splash' },
  { component: DummyComponent, path: 'home' },
];

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let originalMatchMedia: PropertyDescriptor | undefined;

  /**
   * `ViewportBreakpointService.isDesktop` só muda a partir de `matchMedia`
   * (o signal que ele deriva é privado — não dá pra escrever nele do spec).
   * Mesmo mock de `viewport-breakpoint.service.spec.ts`.
   */
  function installMatchMedia(matches: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string): MediaQueryList =>
        ({
          addEventListener: (): void => undefined,
          matches,
          media: query,
          removeEventListener: (): void => undefined,
        }) as unknown as MediaQueryList,
    });
  }

  beforeEach(async () => {
    originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    installMatchMedia(false);

    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot(ROUTES)],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    await TestBed.inject(Router).navigateByUrl('/home');
    fixture.detectChanges();
  });

  afterEach(() => {
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    }
  });

  it('should create the app', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('opens the mobile menu when the bottom-nav-bar menu button is clicked', () => {
    const menuButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'app-bottom-nav-bar button[aria-label="Abrir menu"]',
    );

    menuButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-nav-menu').classList).toContain('nav-menu--open');
  });

  it('closes the mobile menu when nav-menu emits closed', () => {
    fixture.componentInstance.menuOpen.set(true);
    fixture.detectChanges();

    const navMenu = fixture.debugElement.query(el => el.name === 'app-nav-menu');

    navMenu.triggerEventHandler('closed');
    fixture.detectChanges();

    expect(fixture.componentInstance.menuOpen()).toBe(false);
  });

  it('opens the AI chat surface when the nav-menu logo is clicked', () => {
    const navMenu = fixture.debugElement.query(el => el.name === 'app-nav-menu');

    navMenu.triggerEventHandler('logoClick');
    fixture.detectChanges();

    expect(fixture.componentInstance.aiAssistant.isOpen()).toBe(true);
  });

  it('opens the AI chat surface when the bottom-nav-bar AI button is clicked', () => {
    const aiButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'app-bottom-nav-bar button[aria-label="Abrir assistente de IA"]',
    );

    aiButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.aiAssistant.isOpen()).toBe(true);
  });

  it('renders app-bottom-sheet (not app-drawer) when the viewport is not desktop', () => {
    expect(fixture.nativeElement.querySelector('app-bottom-sheet')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-drawer')).toBeFalsy();
  });

  it('renders app-drawer (not app-bottom-sheet) when the viewport is desktop', async () => {
    // ViewportBreakpointService é `providedIn: 'root'` e já foi instanciado com o
    // mock `false` no `beforeEach` — precisa de um TestBed novo para que o
    // construtor do serviço leia o `matchMedia` reinstalado com `true`.
    TestBed.resetTestingModule();
    installMatchMedia(true);

    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot(ROUTES)],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    await TestBed.inject(Router).navigateByUrl('/home');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-drawer')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-bottom-sheet')).toBeFalsy();
  });

  it('closes the AI chat surface when the bottom-sheet emits closed', () => {
    fixture.componentInstance.aiAssistant.openPanel();
    fixture.detectChanges();

    const bottomSheet = fixture.debugElement.query(el => el.name === 'app-bottom-sheet');

    bottomSheet.triggerEventHandler('closed');
    fixture.detectChanges();

    expect(fixture.componentInstance.aiAssistant.isOpen()).toBe(false);
  });

  it('marca Notificações como item ativo do menu em /notifications e nenhum em outras rotas', async () => {
    const component = fixture.componentInstance as unknown as { activeNavItem(): string | null };

    TestBed.inject(Router).resetConfig([
      { children: [], path: 'home' },
      { children: [], path: 'notifications' },
      { children: [], path: 'login' },
    ]);
    await TestBed.inject(Router).navigateByUrl('/home');

    expect(component.activeNavItem()).toBe('home');

    await TestBed.inject(Router).navigateByUrl('/notifications');

    expect(component.activeNavItem()).toBe('notificacoes');

    await TestBed.inject(Router).navigateByUrl('/login');

    expect(component.activeNavItem()).toBeNull();
  });

  describe('conversa limpa a cada abertura (RN-03)', () => {
    function reopen(): void {
      fixture.componentInstance.aiAssistant.closePanel();
      fixture.detectChanges();
      fixture.componentInstance.aiAssistant.openPanel();
      fixture.detectChanges();
    }

    it('volta ao chat inicial, encaixe compacto e campo vazio ao reabrir', () => {
      const component = fixture.componentInstance as unknown as {
        aiChatValue: WritableLike<string>;
        aiSheetSnap: WritableLike<string>;
        aiAssistant: AppComponent['aiAssistant'];
      };

      component.aiAssistant.openShortcuts();
      component.aiSheetSnap.set('full');
      component.aiChatValue.set('rascunho');
      fixture.detectChanges();

      reopen();

      expect(component.aiAssistant.view()).toBe('chat');
      expect(component.aiSheetSnap()).toBe('default');
      expect(component.aiChatValue()).toBe('');
      expect(fixture.nativeElement.querySelector('app-input-chat textarea').value).toBe('');
    });

    it('fecha pelo scrim/Esc/arraste (evento closed) e reabre limpo', () => {
      const component = fixture.componentInstance as unknown as { aiChatValue: WritableLike<string> };

      fixture.componentInstance.aiAssistant.openPanel();
      fixture.detectChanges();
      component.aiChatValue.set('texto');
      fixture.debugElement.query(el => el.name === 'app-bottom-sheet').triggerEventHandler('closed');
      fixture.detectChanges();
      fixture.componentInstance.aiAssistant.openPanel();
      fixture.detectChanges();

      expect(component.aiChatValue()).toBe('');
    });
  });

  describe('expandir e fechar o assistente (mobile/tablet)', () => {
    function sheetButton(label: string): HTMLButtonElement | null {
      return fixture.nativeElement.querySelector(`app-bottom-sheet button[aria-label="${label}"]`);
    }

    function openWithConversation(): HTMLElement {
      fixture.componentInstance.aiAssistant.openShortcuts();
      fixture.detectChanges();

      return fixture.nativeElement.querySelector('app-assistant-content .assistant-content');
    }

    function dialog(): HTMLDialogElement {
      return fixture.nativeElement.querySelector('app-bottom-sheet dialog');
    }

    it('não mostra botão de expandir no mobile', () => {
      openWithConversation();

      expect(sheetButton('Expandir')).toBeNull();
      expect(sheetButton('Fechar')).toBeTruthy();
    });

    it('fecha a partir do painel compacto, devolvendo a Home com a rolagem destravada', () => {
      openWithConversation();

      sheetButton('Fechar')?.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.aiAssistant.isOpen()).toBe(false);
      expect(dialog().open).toBe(false);
      expect(document.documentElement.style.overflow).not.toBe('hidden');
    });

    it('fecha e reabre no encaixe compacto', () => {
      openWithConversation();
      sheetButton('Fechar')?.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.aiAssistant.isOpen()).toBe(false);
      expect(dialog().open).toBe(false);

      fixture.componentInstance.aiAssistant.openPanel();
      fixture.detectChanges();

      expect(dialog().open).toBe(true);
      expect(dialog().classList).not.toContain('bottom-sheet--full');
    });
  });

  it('onAiShortcut and onAiSend do not throw (sem serviço de conversa com a IA ainda)', () => {
    expect(() => fixture.componentInstance.onAiShortcut({ id: 'x', label: 'X' })).not.toThrow();
    expect(() => fixture.componentInstance.onAiSend('mensagem')).not.toThrow();
  });

  it('onAiShortcut sends the chip label as the question (Figma: chips do painel)', () => {
    fixture.componentInstance.onAiShortcut({ id: 'pendencias', label: 'Quais são minhas pendências de hoje?' });

    expect(fixture.componentInstance.aiAssistant.lastQuestion()).toBe('Quais são minhas pendências de hoje?');
  });

  it('onAiSend forwards the typed question to the assistant', () => {
    fixture.componentInstance.onAiSend('mensagem livre');

    expect(fixture.componentInstance.aiAssistant.lastQuestion()).toBe('mensagem livre');
  });

  it('hides the navigation shell and the AI surface on routes flagged hideShell', async () => {
    const el = fixture.nativeElement as HTMLElement;

    await TestBed.inject(Router).navigateByUrl('/splash');
    fixture.detectChanges();

    expect(el.querySelector('app-nav-menu')).toBeNull();
    expect(el.querySelector('app-bottom-nav-bar')).toBeNull();
    expect(el.querySelector('app-bottom-sheet')).toBeNull();

    await TestBed.inject(Router).navigateByUrl('/home');
    fixture.detectChanges();

    expect(el.querySelector('app-nav-menu')).not.toBeNull();
    expect(el.querySelector('app-bottom-nav-bar')).not.toBeNull();
  });

  it('mounts a single bottom nav bar with the three accesses on /home', () => {
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('app-bottom-nav-bar').length).toBe(1);
    expect(el.querySelectorAll('app-bottom-nav-bar nav button').length).toBe(3);
  });

  it('navigates to /notifications and closes the mobile menu when Notificações is clicked', () => {
    const router = TestBed.inject(Router);

    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.menuOpen.set(true);
    fixture.detectChanges();
    const item = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('app-nav-menu .nav-menu__links .nav-menu__link'),
    ).find(el => el.textContent?.includes('Notificações'));

    item?.click();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/notifications']);
    expect(fixture.componentInstance.menuOpen()).toBeFalse();
  });

  it('navigates to /home and closes the mobile menu when the Home item is clicked', () => {
    const router = TestBed.inject(Router);

    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.menuOpen.set(true);
    fixture.detectChanges();
    const home = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('app-nav-menu .nav-menu__links .nav-menu__link'),
    ).find(el => el.textContent?.includes('Home'));

    home?.click();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    expect(fixture.componentInstance.menuOpen()).toBeFalse();
  });
});
