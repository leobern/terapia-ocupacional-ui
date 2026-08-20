import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { BackgroundMeshComponent } from './shared/components/background-mesh/background-mesh.component';
import { BottomNavBarComponent } from './shared/components/bottom-nav-bar/bottom-nav-bar.component';
import {
  BottomSheetComponent,
  type BottomSheetSnap,
  type ChatShortcut,
} from './shared/components/bottom-sheet/bottom-sheet.component';
import { DrawerComponent, type DrawerSnap } from './shared/components/drawer/drawer.component';
import { InputChatComponent } from './shared/components/input-chat/input-chat.component';
import { NavMenuComponent } from './shared/components/nav-menu/nav-menu.component';
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

  protected readonly viewportBreakpoint = inject(ViewportBreakpointService);
  protected readonly isNotificationsRoute = computed(() => this.currentUrl().startsWith('/notifications'));
  // '#D3FFE9' é o default do próprio app-background-mesh — repetido aqui só
  // porque o binding precisa de um valor concreto nas duas pontas do ternário.
  protected readonly backgroundColor1 = computed(() => (this.isNotificationsRoute() ? '#a6fbfb' : '#D3FFE9'));
  protected readonly backgroundShowColor2 = computed(() => !this.isNotificationsRoute());
  protected readonly aiSheetSnap = signal<BottomSheetSnap>('default');
  protected readonly aiDrawerSnap = signal<DrawerSnap>('default');

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

  // public: exercitados diretamente pelo spec (ver `menuOpen`/`aiAssistant` acima).
  onAiShortcut(_: ChatShortcut): void {
    // Conduzir a conversa com a IA fica para quando o serviço de chat existir
    // — por enquanto só fecha o atalho selecionado, sem enviar nada de verdade.
  }

  onAiSend(_: string): void {
    // Ver onAiShortcut — mesma justificativa.
  }

  // specs/004-notificacoes FR-001/FR-002/research.md §8 — o Menu é global (montado
  // aqui, fora de qualquer feature), então não conhece o hospital em contexto; a
  // tela de Notificações resolve isso sozinha (GET /api/v1/home/hospitals, mesmo
  // default da Home) quando entra sem `hospitalId` na query.
  protected onNotificacoesClick(): void {
    this.menuOpen.set(false);
    this.router.navigate(['/notifications']);
  }
}
