import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterModule, Routes } from '@angular/router';

import { AppComponent } from './app.component';
import { LogoutService } from './features/auth/logout.service';
import { SessionRevoker } from './features/auth/session-revoker';
import { Role, SessionRoleReader } from './shared/auth/session-role';
import { type ScreenAction, ScreenActionsService } from './shared/services/screen-actions.service';
import { UserDirectory } from './shared/services/user-directory';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

interface WritableLike<T> {
  (): T;
  set(value: T): void;
}

const ROUTES: Routes = [
  { component: DummyComponent, data: { hideShell: true }, path: 'splash' },
  { component: DummyComponent, path: 'home' },
  { component: DummyComponent, path: 'login' },
];

const TEST_PROVIDERS = [
  { provide: SessionRoleReader, useValue: { read: (): Role => Role.GESTOR } },
  { provide: SessionRevoker, useValue: { revokeCurrentDevice: (): Promise<void> => Promise.resolve() } },
  { provide: UserDirectory, useValue: { search: (): Promise<[]> => Promise.resolve([]) } },
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
    // O I18nService escolhe o idioma ao ser criado: fixa pt-BR antes de criar o AppComponent.
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    installMatchMedia(false);

    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot(ROUTES)],
      providers: TEST_PROVIDERS,
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
      providers: TEST_PROVIDERS,
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

  it('marca o item ativo do menu pela rota e nenhum em /notifications (fora do menu)', async () => {
    const component = fixture.componentInstance as unknown as { activeNavItem(): string | null };

    TestBed.inject(Router).resetConfig([
      { children: [], path: 'home' },
      { children: [], path: 'notifications' },
      { children: [], path: 'pharmacy' },
      { children: [], path: 'patients' },
      { children: [], path: 'hospital-links' },
      { children: [], path: 'login' },
    ]);
    await TestBed.inject(Router).navigateByUrl('/home');

    expect(component.activeNavItem()).toBe('home');

    await TestBed.inject(Router).navigateByUrl('/notifications');

    expect(component.activeNavItem()).toBeNull();

    await TestBed.inject(Router).navigateByUrl('/pharmacy');

    expect(component.activeNavItem()).toBe('farmacia');

    await TestBed.inject(Router).navigateByUrl('/patients');

    expect(component.activeNavItem()).toBe('pacientes');

    await TestBed.inject(Router).navigateByUrl('/hospital-links');

    expect(component.activeNavItem()).toBe('vinculos');

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

  describe('atalhos da tela no assistente (padrão de 23/11)', () => {
    const action = (id: string, label: string, form = false): ScreenAction => ({
      id,
      label,
      ...(form
        ? {
            form: {
              fields: [{ id: 'm', kind: 'text', label: 'Mensagem?', placeholder: 'x', required: true }],
              submit: (): void => undefined,
              submitLabel: 'Criar',
              title: 'Criar item',
            },
          }
        : {}),
    });
    const chips = (): string[] =>
      Array.from(fixture.nativeElement.querySelectorAll('.bottom-sheet__shortcut')).map(
        e => (e as HTMLElement).textContent?.trim() ?? '',
      );
    const sheetSnap = (): string => (fixture.componentInstance as unknown as { aiSheetSnap(): string }).aiSheetSnap();

    it('no chat, as ações da tela viram os chips acima do campo de mensagem (sem as perguntas genéricas)', () => {
      TestBed.inject(ScreenActionsService).register([action('a', 'Criar item', true), action('b', 'Editar item')]);
      fixture.componentInstance.aiAssistant.openPanel();
      fixture.detectChanges();

      expect(chips()).toEqual(['Criar item', 'Editar item']);
      expect(fixture.nativeElement.querySelector('app-input-chat')).not.toBeNull();
    });

    it('tocar no chip de uma ação da tela abre o cadastro dela, em tela cheia', () => {
      TestBed.inject(ScreenActionsService).register([action('a', 'Criar item', true)]);
      fixture.componentInstance.aiAssistant.openPanel();
      fixture.detectChanges();

      expect(sheetSnap()).toBe('default');

      fixture.nativeElement.querySelector('.bottom-sheet__shortcut button').click();
      fixture.detectChanges();

      expect(fixture.componentInstance.aiAssistant.view()).toBe('form');
      expect(sheetSnap()).toBe('full');
    });

    it('tocar numa pergunta rápida pergunta à IA em vez de abrir uma ação', () => {
      fixture.componentInstance.aiAssistant.openPanel();
      fixture.detectChanges();
      const questionChip = Array.from(
        fixture.nativeElement.querySelectorAll('.bottom-sheet__shortcut button'),
      )[0] as HTMLButtonElement;

      questionChip.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.aiAssistant.view()).toBe('chat');
      expect(fixture.componentInstance.aiAssistant.lastQuestion()).not.toBeNull();
    });

    it('a tela de Atalhos não tem campo de mensagem nem chips embaixo; as ações ficam no conteúdo', () => {
      TestBed.inject(ScreenActionsService).register([action('a', 'Criar item', true)]);
      fixture.componentInstance.aiAssistant.openShortcuts();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-input-chat')).toBeNull();
      expect(chips()).toEqual([]);
      expect(fixture.nativeElement.querySelector('.assistant-content__actions app-tip')).not.toBeNull();
      expect(sheetSnap()).toBe('default');
    });

    it('ação indisponível também abre sem campo de mensagem', () => {
      TestBed.inject(ScreenActionsService).register([action('x', 'Ainda não existe')]);
      fixture.componentInstance.aiAssistant.openAction(action('x', 'Ainda não existe'));
      fixture.detectChanges();

      expect(fixture.componentInstance.aiAssistant.view()).toBe('unavailable');
      expect(fixture.nativeElement.querySelector('app-input-chat')).toBeNull();
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

  it('onAiAudio encaminha a gravação ao assistente', () => {
    spyOn(fixture.componentInstance.aiAssistant, 'askAudio');
    const audio = new Blob(['x']);

    fixture.componentInstance.onAiAudio(audio);

    expect(fixture.componentInstance.aiAssistant.askAudio).toHaveBeenCalledWith(audio);
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

  it('o menu não tem Notificações nem Configurações', () => {
    fixture.componentInstance.menuOpen.set(true);
    fixture.detectChanges();
    const labels = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('app-nav-menu .nav-menu__links .nav-menu__link'),
    ).map(el => el.textContent.trim());

    expect(labels).toEqual(['Hospitais', 'Pacientes', 'Farmácia', 'Vínculos', 'Tutorial']);
  });

  it('navigates to /settings/tutorial and closes the mobile menu when Tutorial is clicked', () => {
    const router = TestBed.inject(Router);

    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.menuOpen.set(true);
    fixture.detectChanges();
    const item = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('app-nav-menu .nav-menu__links .nav-menu__link'),
    ).find(el => el.textContent?.includes('Tutorial'));

    item?.click();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/settings/tutorial']);
    expect(fixture.componentInstance.menuOpen()).toBeFalse();
  });

  it('marca Tutorial como item ativo do menu em /settings', async () => {
    const component = fixture.componentInstance as unknown as { activeNavItem(): string | null };

    TestBed.inject(Router).resetConfig([{ children: [], path: 'settings' }]);
    await TestBed.inject(Router).navigateByUrl('/settings');

    expect(component.activeNavItem()).toBe('tutorial');
  });

  it('navigates to /hospital-links and closes the mobile menu when Vínculos is clicked', () => {
    const router = TestBed.inject(Router);

    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.menuOpen.set(true);
    fixture.detectChanges();
    const item = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('app-nav-menu .nav-menu__links .nav-menu__link'),
    ).find(el => el.textContent?.includes('Vínculos'));

    item?.click();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/hospital-links']);
    expect(fixture.componentInstance.menuOpen()).toBeFalse();
  });

  it('navigates to /pharmacy and closes the mobile menu when Farmácia is clicked', () => {
    const router = TestBed.inject(Router);

    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.menuOpen.set(true);
    fixture.detectChanges();
    const item = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('app-nav-menu .nav-menu__links .nav-menu__link'),
    ).find(el => el.textContent?.includes('Farmácia'));

    item?.click();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/pharmacy']);
    expect(fixture.componentInstance.menuOpen()).toBeFalse();
  });

  it('navigates to /home and closes the mobile menu when the Hospitais item is clicked', () => {
    const router = TestBed.inject(Router);

    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.componentInstance.menuOpen.set(true);
    fixture.detectChanges();
    const home = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('app-nav-menu .nav-menu__links .nav-menu__link'),
    ).find(el => el.textContent?.includes('Hospitais'));

    home?.click();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    expect(fixture.componentInstance.menuOpen()).toBeFalse();
  });

  describe('logout', () => {
    let logout: jasmine.Spy;
    let router: Router;
    let logoutFixture: ComponentFixture<AppComponent>;
    let el: HTMLElement;

    const button = (label: string): HTMLButtonElement | undefined =>
      Array.from(el.querySelectorAll('dialog[open] button')).find(b => b.textContent?.trim() === label) as
        HTMLButtonElement | undefined;

    beforeEach(async () => {
      logout = jasmine.createSpy('logout').and.resolveTo();
      TestBed.inject(LogoutService).logout = logout as unknown as LogoutService['logout'];
      router = TestBed.inject(Router);
      logoutFixture = TestBed.createComponent(AppComponent);
      el = logoutFixture.nativeElement as HTMLElement;
      await router.navigateByUrl('/home');
      logoutFixture.detectChanges();
      el.querySelector<HTMLButtonElement>('.nav-menu__link--logout')?.click();
      logoutFixture.detectChanges();
    });

    it('asks for confirmation before ending the session', () => {
      expect(logout).not.toHaveBeenCalled();
      expect(el.textContent).toContain('Deseja sair da conta?');
    });

    it('ends the session and redirects to login on confirm', async () => {
      button('Sair')?.click();
      await logoutFixture.whenStable();

      expect(logout).toHaveBeenCalledTimes(1);
      expect(router.url).toBe('/login');
    });

    it('keeps the session and the route on cancel', async () => {
      button('Cancelar')?.click();
      await logoutFixture.whenStable();
      logoutFixture.detectChanges();

      expect(logout).not.toHaveBeenCalled();
      expect(router.url).toBe('/home');
      expect(el.querySelector<HTMLDialogElement>('dialog')?.open ?? false).toBeFalse();
    });

    it('calls logout once when Confirm is double-clicked and disables the button meanwhile', async () => {
      let release!: () => void;

      logout.and.returnValue(new Promise<void>(resolve => (release = resolve)));
      const confirm = button('Sair') as HTMLButtonElement;

      confirm.click();
      confirm.click();
      logoutFixture.detectChanges();

      expect(logout).toHaveBeenCalledTimes(1);
      expect(button('Sair')?.disabled).toBeTrue();

      release();
      await logoutFixture.whenStable();

      expect(logout).toHaveBeenCalledTimes(1);
      expect(router.url).toBe('/login');
    });

    it('opens the confirmation from the Sair button inside the mobile menu panel', () => {
      button('Cancelar')?.click();
      logoutFixture.detectChanges();
      el.querySelector<HTMLButtonElement>('app-bottom-nav-bar button')?.click();
      logoutFixture.detectChanges();

      expect(logoutFixture.componentInstance.menuOpen()).toBeTrue();

      el.querySelector<HTMLButtonElement>('.nav-menu__link--logout')?.click();
      logoutFixture.detectChanges();

      expect(el.textContent).toContain('Deseja sair da conta?');
      expect(logoutFixture.componentInstance.menuOpen()).toBeFalse();
      expect(logout).not.toHaveBeenCalled();
    });

    it('ends the session and goes to /login when confirming from the mobile menu', async () => {
      button('Cancelar')?.click();
      logoutFixture.detectChanges();
      el.querySelector<HTMLButtonElement>('app-bottom-nav-bar button')?.click();
      logoutFixture.detectChanges();
      el.querySelector<HTMLButtonElement>('.nav-menu__link--logout')?.click();
      logoutFixture.detectChanges();
      button('Sair')?.click();
      await logoutFixture.whenStable();

      expect(logout).toHaveBeenCalledTimes(1);
      expect(router.url).toBe('/login');
    });
  });
});
