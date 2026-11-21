import { ChangeDetectionStrategy, Component, computed, effect, inject, Signal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { Role, SessionRoleReader } from './shared/auth/session-role';
import { AssistantContentComponent } from './shared/components/assistant-content/assistant-content.component';
import { AssistantHeadingComponent } from './shared/components/assistant-header/assistant-heading.component';
import { AssistantSubmitComponent } from './shared/components/assistant-submit/assistant-submit.component';
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
import { DrawerComponent, type DrawerSnap } from './shared/components/drawer/drawer.component';
import { InputChatComponent, type InputChatMode } from './shared/components/input-chat/input-chat.component';
import { NavMenuComponent, type NavMenuItemKey } from './shared/components/nav-menu/nav-menu.component';
import { AiAssistantService } from './shared/services/ai-assistant.service';
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
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AssistantContentComponent,
    AssistantHeadingComponent,
    AssistantSubmitComponent,
    BackgroundMeshComponent,
    BottomNavBarComponent,
    BottomSheetComponent,
    DrawerComponent,
    InputChatComponent,
    NavMenuComponent,
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
  protected readonly disabledNavItems: readonly NavMenuItemKey[] =
    inject(SessionRoleReader).read() === Role.GESTOR ? [] : ['farmacia'];

  protected readonly viewportBreakpoint = inject(ViewportBreakpointService);
  /** Rotas com `data.hideShell` (ex.: splash) ocultam a navegação e o assistente. */
  protected readonly showShell: Signal<boolean>;

  /** Item ativo do menu (Figma v2/NavRail: Home destacada na Home, Notificações em Notificações). */
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

    return url.startsWith('/notifications') ? 'notificacoes' : null;
  });

  // Home usa o gradiente de fundo do Figma; as demais telas seguem com os círculos por enquanto.
  protected readonly backgroundVariant = computed<BackgroundMeshVariant>(() => {
    const url = this.currentUrl();

    if (url.startsWith('/patients')) {
      return 'patients';
    }

    return url.startsWith('/home') ? 'gradient' : 'blobs';
  });
  protected readonly isNotificationsRoute = computed(() => this.currentUrl().startsWith('/notifications'));
  protected readonly aiSheetSnap = signal<BottomSheetSnap>('default');
  protected readonly aiDrawerSnap = signal<DrawerSnap>('default');
  protected readonly aiChatValue = signal('');
  protected readonly aiChatMode = signal<InputChatMode>('text');

  /** Faixa de botões do painel: perguntas rápidas só no chat; as ações da tela aparecem no próprio conteúdo. */
  /** Ação aberta (formulário ou aviso): o cabeçalho do painel mostra título + voltar no lugar da logo. */
  protected readonly showAssistantHeading = computed(() => ['form', 'unavailable'].includes(this.aiAssistant.view()));

  // Figma (seção 09): os chips ficam junto do campo de mensagem e somem quando a
  // resposta já foi exibida (tela A2); continuam durante a busca e no aviso de falha.
  protected readonly shortcuts = computed<readonly ChatShortcut[]>(() =>
    this.aiAssistant.view() === 'chat' && this.aiAssistant.conversation()?.status !== 'answered'
      ? this.aiShortcuts
      : [],
  );

  protected readonly aiShortcuts: readonly ChatShortcut[] = [
    { id: 'pendencias', label: 'Quais são minhas pendências de hoje?' },
    { id: 'meta-nutricional', label: 'Pacientes fora da meta nutricional' },
  ];

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
    // RN-03: toda abertura começa limpa. Qualquer caminho de fechamento (botão, scrim,
    // Esc, arrastar) chega em `isOpen() === false`; a visão/ação já são zeradas pelo
    // serviço, aqui zera o que vive no shell: encaixe e campo de mensagem.
    effect(() => {
      if (!this.aiAssistant.isOpen()) {
        this.aiSheetSnap.set('default');
        this.aiDrawerSnap.set('default');
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

  // public: exercitados diretamente pelo spec (ver `menuOpen`/`aiAssistant` acima).
  /** Chip de sugestão: envia a pergunta ao assistente (mesmo fluxo de digitar). */
  onAiShortcut(shortcut: ChatShortcut): void {
    this.aiAssistant.ask(shortcut.label);
  }

  onAiAudio(audio: Blob): void {
    this.aiAssistant.askAudio(audio);
  }

  onAiSend(question: string): void {
    this.aiAssistant.ask(question);
  }

  // specs/004-notificacoes FR-001/FR-002/research.md §8 — o Menu é global (montado
  // aqui, fora de qualquer feature), então não conhece o hospital em contexto; a
  // tela de Notificações resolve isso sozinha (GET /api/v1/home/hospitals, mesmo
  // default da Home) quando entra sem `hospitalId` na query.
  protected onHomeClick(): void {
    this.menuOpen.set(false);
    void this.router.navigate(['/home']);
  }

  protected onPacientesClick(): void {
    this.menuOpen.set(false);
    void this.router.navigate(['/patients']);
  }

  protected onNotificacoesClick(): void {
    this.menuOpen.set(false);
    this.router.navigate(['/notifications']);
  }

  protected onFarmaciaClick(): void {
    this.menuOpen.set(false);
    void this.router.navigate(['/pharmacy']);
  }
}
