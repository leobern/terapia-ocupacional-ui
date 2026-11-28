import { ChangeDetectionStrategy, Component, computed, effect, inject, Signal, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { LogoutService } from './features/auth/logout.service';
import { LogoutConfirmComponent } from './features/auth/logout-confirm.component';
import { Role, SessionRoleReader } from './shared/auth/session-role';
import { AssistantContentComponent } from './shared/components/assistant-content/assistant-content.component';
import { AssistantEditorFooterComponent } from './shared/components/assistant-editor-footer/assistant-editor-footer.component';
import { AssistantFormFooterComponent } from './shared/components/assistant-form-footer/assistant-form-footer.component';
import { AssistantHeadingComponent } from './shared/components/assistant-header/assistant-heading.component';
import {
  BackgroundMeshComponent,
  type BackgroundMeshVariant,
} from './shared/components/background-mesh/background-mesh.component';
import { BottomNavBarComponent } from './shared/components/bottom-nav-bar/bottom-nav-bar.component';
import {
  BottomSheetComponent,
  type BottomSheetSnap,
  type ChatShortcut,
} from './shared/components/bottom-sheet/bottom-sheet.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { DrawerComponent, type DrawerSnap } from './shared/components/drawer/drawer.component';
import { InputChatComponent, type InputChatMode } from './shared/components/input-chat/input-chat.component';
import { NavMenuComponent, type NavMenuItemKey } from './shared/components/nav-menu/nav-menu.component';
import { PrivacyOverlayComponent } from './shared/components/privacy-overlay/privacy-overlay.component';
import { AiAssistantService } from './shared/services/ai-assistant.service';
import { REGISTER_PATIENT_ACTION_ID } from './shared/services/assistant-action-router';
import { AssistantConversationService } from './shared/services/assistant-conversation.service';
import { I18nService } from './shared/services/i18n.service';
import { ScreenActionsService, type ScreenSuggestion } from './shared/services/screen-actions.service';
import { ViewportBreakpointService } from './shared/services/viewport-breakpoint.service';

/**
 * Shell da aplicação: hospeda o par simétrico de navegação — `app-nav-menu`
 * (trilho de desktop / painel deslizante de mobile, mesmo componente) e
 * `app-bottom-nav-bar` (barra inferior, só em `xs`/`sm`) — e o par simétrico
 * do chat da IA: `app-bottom-sheet` (mobile/tablet) / `app-drawer` (desktop),
 * escolhido em runtime por `ViewportBreakpointService` (mesma decisão que os
 * dois componentes já tomam sozinhos — o `@if` aqui é só o que a doc de cada
 * um pede ao consumidor). Todos instância ÚNICA aqui; nenhuma tela os monta.
 *
 * NOTA: os atalhos e a mensagem de abertura da IA são texto fixo — ainda não
 * há serviço de conversa com a IA no frontend (fora do escopo desta tela).
 */
/** Prefixo do id dos chips que são ações da tela (os outros são perguntas rápidas). */
const ACTION_SHORTCUT_PREFIX = 'action:';
/** Chips do cadastro por conversa (opções, "Pular", "Tentar novamente"): ficam acima do campo de mensagem. */
const CONVERSATION_SHORTCUT_PREFIX = 'conversation:';
const CONVERSATION_SKIP_ID = CONVERSATION_SHORTCUT_PREFIX + '__skip';
const CONVERSATION_RETRY_ID = CONVERSATION_SHORTCUT_PREFIX + '__retry';
const CONVERSATION_JUMP_ID = CONVERSATION_SHORTCUT_PREFIX + '__jump';
/** Pausa "pensando" antes de cada pergunta da IA no cadastro por conversa. */
const CONVERSATION_THINKING_MS = 700;
/** A dica de texto/áudio entra acima do campo de mensagem este tempo depois de cada nova mensagem. */
const ASSISTANT_HINT_DELAY_MS = 5000;
/** Quantas ações da tela entram como sugestão sob o botão central da barra inferior. */
const MAX_NAV_SUGGESTIONS = 3;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    AssistantContentComponent,
    AssistantHeadingComponent,
    AssistantEditorFooterComponent,
    AssistantFormFooterComponent,
    BackgroundMeshComponent,
    BottomNavBarComponent,
    BottomSheetComponent,
    DrawerComponent,
    InputChatComponent,
    LogoutConfirmComponent,
    NavMenuComponent,
    PrivacyOverlayComponent,
    RouterOutlet,
  ],
  selector: 'app-root',
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html',
})
export class AppComponent {
  // public: os specs disparam abertura/fechamento do assistente e do menu
  // diretamente na instância do componente.
  readonly aiAssistant = inject(AiAssistantService);
  readonly menuOpen = signal(false);

  /** Itens do menu sem acesso para o perfil atual (Farmácia é exclusiva do gestor). */
  /**
   * Sugestões do botão central: as que a tela registrou (ex.: a Home) ou, sem elas, as ações principais da tela (as
   * mesmas dos Atalhos). Assim toda tela herda o padrão: o CTA principal vira frase na legenda (Thiago, 2026-11-25).
   */
  protected readonly navSuggestions = computed<readonly ScreenSuggestion[]>(() => {
    const explicit = this.screenActions.suggestions();

    return explicit.length > 0
      ? explicit
      : this.screenActions
          .actions()
          .slice(0, MAX_NAV_SUGGESTIONS)
          .map(action => ({ label: action.label, run: (): void => this.aiAssistant.openAction(action) }));
  });
  protected readonly suggestionLabels = computed(() => this.navSuggestions().map(s => s.label));

  protected readonly disabledNavItems = computed<readonly NavMenuItemKey[]>(() =>
    this.roleReader.read() === Role.GESTOR ? [] : ['farmacia'],
  );

  protected readonly viewportBreakpoint = inject(ViewportBreakpointService);
  /** Rotas com `data.hideShell` (ex.: splash) ocultam a navegação e o assistente. */
  protected readonly showShell: Signal<boolean>;
  protected readonly confirmOpen = signal(false);
  /** Trava reentrância: duplo clique em Confirmar não pode chamar `logout()` duas vezes. */
  protected readonly loggingOut = signal(false);

  /** Item ativo do menu (Figma v2/NavRail: Hospitais na Home, Pacientes, Farmácia e Tutorial). */
  protected readonly activeNavItem = computed<NavMenuItemKey | null>(() => {
    const url = this.currentUrl() ?? '';

    if (url.startsWith('/home')) {
      return 'home';
    }

    if (url.startsWith('/pharmacy')) {
      return 'farmacia';
    }

    if (url.startsWith('/patients')) {
      return 'pacientes';
    }

    if (url.startsWith('/hospital-links')) {
      return 'vinculos';
    }

    if (url.startsWith('/team')) {
      return 'equipe';
    }

    return url.startsWith('/settings') || url.startsWith('/tutorial') ? 'tutorial' : null;
  });

  // Home usa o gradiente de fundo do Figma; as demais telas seguem com os círculos por enquanto.
  protected readonly backgroundVariant = computed<BackgroundMeshVariant>(() => {
    const url = this.currentUrl();

    if (url.startsWith('/patients')) {
      return 'patients';
    }

    if (url.startsWith('/notifications')) {
      return 'notifications';
    }

    // Telas de acesso (Figma seção 12) usam o mesmo gradiente da Home, no claro e no escuro.
    return ['/home', '/login', '/forgot-password', '/reset-password', '/invite', '/mfa', '/lock'].some(prefix =>
      url.startsWith(prefix),
    )
      ? 'gradient'
      : 'blobs';
  });
  protected readonly isNotificationsRoute = computed(() => this.currentUrl().startsWith('/notifications'));
  protected readonly aiSheetSnap = signal<BottomSheetSnap>('default');
  protected readonly aiDrawerSnap = signal<DrawerSnap>('default');
  /** O usuário recolheu o cadastro (100%) para a meia sidebar: vale até fechar o painel. */
  protected readonly drawerCollapsedByUser = signal(false);
  /**
   * Cadastro por conversa abre direto em 100% (Thiago, 2026-11-27). O encaixe sai já certo na primeira renderização
   * (sem abrir na meia e depois expandir), para a sidebar entrar flutuando, com animação e sem mexer no layout.
   */
  protected readonly drawerSnap = computed<DrawerSnap>(() =>
    this.aiAssistant.view() === 'conversation' && !this.drawerCollapsedByUser() ? 'expanded' : this.aiDrawerSnap(),
  );
  protected readonly aiChatValue = signal('');
  protected readonly aiChatMode = signal<InputChatMode>('text');

  /** Cadastro por conversa já iniciado (há resposta do usuário) e ainda não concluído: fechar pede confirmação. */
  protected readonly registrationInProgress = computed(
    () =>
      this.aiAssistant.isOpen() &&
      this.aiAssistant.view() === 'conversation' &&
      !this.flow.finished() &&
      this.flow.messages().some(message => message.role === 'user'),
  );
  /** Diálogo "Parar o cadastro?" (fechar a sidebar ou trocar de tela no meio do cadastro). */
  protected readonly discardOpen = signal(false);
  /** Texto de apoio acima do campo de mensagem (alinhado à direita), só no chat e no cadastro por conversa. */
  protected readonly assistantHint = computed(() => {
    const view = this.aiAssistant.view();

    if (view === 'conversation') {
      return 'Você também pode responder via áudio.';
    }

    return view === 'chat' ? 'Você pode conversar comigo via texto ou áudio.' : '';
  });
  protected readonly assistantHintVisible = signal(false);

  /** Faixa de botões do painel: perguntas rápidas só no chat; as ações da tela aparecem no próprio conteúdo. */
  /** Atalhos: o cabeçalho mostra o título "Atalhos" no lugar do logo (e não há redimensionar). */
  protected readonly showAssistantHeading = computed(() => this.aiAssistant.view() === 'shortcuts');

  // Figma (seção 09): os chips ficam junto do campo de mensagem e somem quando a
  // resposta já foi exibida (tela A2); continuam durante a busca e no aviso de falha.
  // Os atalhos (tips) da TELA ficam acima do campo de mensagem do chat. Só quando
  // existe o campo de mensagem/áudio: na primeira tela de "Atalhos" (sem campo) os tips ficam no próprio conteúdo.
  protected readonly shortcuts = computed((): readonly ChatShortcut[] => {
    if (this.aiAssistant.view() === 'conversation') {
      return this.conversationShortcuts();
    }
    if (this.aiAssistant.view() !== 'chat' || this.aiAssistant.conversation()?.status === 'answered') {
      return [];
    }
    const actions = this.screenActions
      .actions()
      .map(action => ({ id: ACTION_SHORTCUT_PREFIX + action.id, label: action.label }));

    // Tela com ações: só os atalhos dela (poucos chips, como no Figma). Sem ações: as perguntas rápidas genéricas.
    return actions.length > 0 ? actions : this.aiShortcuts;
  });

  protected readonly aiShortcuts: readonly ChatShortcut[] = [
    { id: 'pendencias', label: 'Quais são minhas pendências de hoje?' },
    { id: 'meta-nutricional', label: 'Pacientes fora da meta nutricional' },
  ];

  private readonly flow = inject(AssistantConversationService);
  private pendingAfterDiscard: (() => void) | null = null;
  private readonly i18n = inject(I18nService);
  /**
   * Cadastro por conversa: as opções da pergunta atual (sexo, sim/não, "Hoje", "Salvar"), o "Pular" e o "Tentar de novo"
   * viram chips junto do campo de mensagem, não botões de 100% no conteúdo (Thiago, 2026-11-27). Somem enquanto a IA
   * "pensa" ou envia.
   */
  private readonly conversationShortcuts = computed((): readonly ChatShortcut[] => {
    if (this.flow.thinking() || this.flow.submitting()) {
      return [];
    }
    const chips: ChatShortcut[] = this.flow.options().map(option => ({
      id: CONVERSATION_SHORTCUT_PREFIX + option.value,
      label: option.label,
      primary: option.primary === true,
    }));

    if (this.flow.canSkip()) {
      chips.push({ id: CONVERSATION_SKIP_ID, label: this.flow.skipLabel() });
    }
    const jump = this.flow.jump();

    if (jump) {
      chips.push({ id: CONVERSATION_JUMP_ID, label: jump.label });
    }
    if (this.flow.canRetry()) {
      chips.push({ id: CONVERSATION_RETRY_ID, label: this.i18n.t('assistant.conversation.retry') });
    }

    return chips;
  });

  private readonly roleReader = inject(SessionRoleReader);
  private readonly screenActions = inject(ScreenActionsService);
  private readonly logoutService = inject(LogoutService);
  private readonly router = inject(Router);

  // O fundo decorativo (app-background-mesh) tem UMA instância global aqui no
  // shell (não uma por tela) — specs/004-notificacoes FR-015 exige 1 blob
  // oculto + cor diferente da Home só nessa rota, então a instância global
  // reage à URL atual em vez de cada feature montar a sua própria.
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
    this.flow.thinkingMs = CONVERSATION_THINKING_MS;
    // Cadastro de paciente salvo: a sidebar fecha e a tela já navegou para o detalhe do paciente (Thiago, 2026-11-27).
    effect(() => {
      const saved =
        this.aiAssistant.view() === 'conversation' &&
        this.aiAssistant.activeAction()?.id === REGISTER_PATIENT_ACTION_ID &&
        this.flow.finished() &&
        this.flow.messages().at(-1)?.tone === 'success';

      if (saved) {
        untracked(() => this.aiAssistant.closePanel());
      }
    });
    // A dica some a cada nova mensagem e volta 5s depois, subindo de baixo (Thiago, 2026-11-27).
    effect(onCleanup => {
      this.flow.messages();
      this.aiAssistant.openCount();
      this.assistantHintVisible.set(false);
      if (!this.aiAssistant.isOpen() || this.assistantHint() === '') {
        return;
      }
      const timer = setTimeout(() => this.assistantHintVisible.set(true), ASSISTANT_HINT_DELAY_MS);

      onCleanup(() => clearTimeout(timer));
    });
    // RN-03: toda abertura começa limpa. Qualquer caminho de fechamento (botão, scrim,
    // Esc, arrastar) chega em `isOpen() === false`; a visão/ação já são zeradas pelo
    // serviço, aqui zera o que vive no shell: encaixe e campo de mensagem.
    // Cadastro (formulário) abre o bottom sheet no máximo (100%); a tela inicial do assistente e os atalhos abrem na metade.
    // No mobile, tudo que abre pelo botão central ocupa a altura máxima; só o painel de Atalhos abre na altura de hoje
    // (Thiago, 2026-11-25).
    effect(() => {
      if (this.aiAssistant.isOpen()) {
        this.aiSheetSnap.set(this.aiAssistant.view() === 'shortcuts' ? 'default' : 'full');
      }
    });

    effect(() => {
      if (!this.aiAssistant.isOpen()) {
        this.aiSheetSnap.set('default');
        this.aiDrawerSnap.set('default');
        this.drawerCollapsedByUser.set(false);
        this.aiChatValue.set('');
        this.aiChatMode.set('text');
      }
    });

    this.showShell = toSignal(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => {
          let route = this.router.routerState.snapshot.root;

          while (route.firstChild) {
            route = route.firstChild;
          }

          return route.data['hideShell'] !== true;
        }),
      ),
      { initialValue: !this.router.url.startsWith('/splash') && this.router.url !== '/' },
    );
  }

  /** Toque no botão central: executa a sugestão que estava visível (se tiver ação) ou só abre o assistente. */
  onNavAiClick(index: number): void {
    const suggestion = index >= 0 ? this.navSuggestions()[index] : undefined;

    if (suggestion?.run) {
      suggestion.run();

      return;
    }
    this.aiAssistant.openPanel();
  }

  // public: exercitados diretamente pelo spec (ver `menuOpen`/`aiAssistant` acima).
  /** Chip de sugestão: envia a pergunta ao assistente (mesmo fluxo de digitar). */
  onAiShortcut(shortcut: ChatShortcut): void {
    if (shortcut.id.startsWith(CONVERSATION_SHORTCUT_PREFIX)) {
      if (shortcut.id === CONVERSATION_SKIP_ID) {
        this.flow.skip();
      } else if (shortcut.id === CONVERSATION_RETRY_ID) {
        this.flow.retry();
      } else if (shortcut.id === CONVERSATION_JUMP_ID) {
        this.flow.jumpToTarget();
      } else {
        const option = this.flow.options().find(o => CONVERSATION_SHORTCUT_PREFIX + o.value === shortcut.id);

        if (option) {
          this.flow.choose(option);
        }
      }

      return;
    }
    if (shortcut.id.startsWith(ACTION_SHORTCUT_PREFIX)) {
      const action = this.screenActions.actions().find(a => ACTION_SHORTCUT_PREFIX + a.id === shortcut.id);

      if (action) {
        this.aiAssistant.openAction(action);

        return;
      }
    }
    this.aiAssistant.ask(shortcut.label);
  }

  onAiAudio(audio: Blob): void {
    this.aiAssistant.askAudio(audio);
  }

  onAiSend(question: string): void {
    this.aiAssistant.ask(question);
  }

  protected onDrawerSnapChange(snap: DrawerSnap): void {
    this.aiDrawerSnap.set(snap);
    if (this.aiAssistant.view() === 'conversation') {
      this.drawerCollapsedByUser.set(snap === 'default');
    }
  }

  // specs/004-notificacoes FR-001/FR-002/research.md §8 — o Menu é global (montado
  // aqui, fora de qualquer feature), então não conhece o hospital em contexto; a
  // tela de Notificações resolve isso sozinha (GET /api/v1/home/hospitals, mesmo
  // default da Home) quando entra sem `hospitalId` na query.
  protected onHomeClick(): void {
    this.menuOpen.set(false);
    this.confirmDiscardThen(() => void this.router.navigate(['/home']));
  }

  protected onPacientesClick(): void {
    this.menuOpen.set(false);
    this.confirmDiscardThen(() => void this.router.navigate(['/patients']));
  }

  protected onTutorialClick(): void {
    this.menuOpen.set(false);
    this.confirmDiscardThen(() => void this.router.navigate(['/settings/tutorial']));
  }

  protected onVinculosClick(): void {
    this.menuOpen.set(false);
    this.confirmDiscardThen(() => void this.router.navigate(['/hospital-links']));
  }

  protected onEquipeClick(): void {
    this.menuOpen.set(false);
    this.confirmDiscardThen(() => void this.router.navigate(['/team']));
  }

  protected onProfileClick(): void {
    this.menuOpen.set(false);
    this.confirmDiscardThen(() => void this.router.navigate(['/profile']));
  }

  protected onFarmaciaClick(): void {
    this.menuOpen.set(false);
    this.confirmDiscardThen(() => void this.router.navigate(['/pharmacy']));
  }

  /** Fechar a sidebar (X, fora, Esc) no meio do cadastro: pergunta antes de perder as respostas. */
  protected onAssistantCloseBlocked(): void {
    this.pendingAfterDiscard = null;
    this.discardOpen.set(true);
  }

  protected confirmDiscard(): void {
    const next = this.pendingAfterDiscard;

    this.pendingAfterDiscard = null;
    this.discardOpen.set(false);
    this.flow.reset();
    this.aiAssistant.closePanel();
    next?.();
  }

  protected cancelDiscard(): void {
    this.pendingAfterDiscard = null;
    this.discardOpen.set(false);
  }

  protected requestLogout(): void {
    this.menuOpen.set(false);
    this.confirmOpen.set(true);
  }

  protected cancelLogout(): void {
    this.confirmOpen.set(false);
  }

  protected async confirmLogout(): Promise<void> {
    if (this.loggingOut()) {
      return;
    }

    this.loggingOut.set(true);

    try {
      await this.logoutService.logout();
    } finally {
      this.loggingOut.set(false);
    }

    this.confirmOpen.set(false);
    // replaceUrl: a rota autenticada atual sai do histórico.
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  /**
   * Com um cadastro em andamento, trocar de tela pergunta antes (perde o que já foi respondido); confirmado, fecha a
   * sidebar e segue para o destino.
   */
  private confirmDiscardThen(run: () => void): void {
    if (this.registrationInProgress()) {
      this.pendingAfterDiscard = run;
      this.discardOpen.set(true);

      return;
    }
    run();
  }
}
