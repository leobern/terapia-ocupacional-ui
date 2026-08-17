import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

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
  protected readonly viewportBreakpoint = inject(ViewportBreakpointService);
  protected readonly aiAssistant = inject(AiAssistantService);

  protected readonly menuOpen = signal(false);
  protected readonly aiSheetSnap = signal<BottomSheetSnap>('default');
  protected readonly aiDrawerSnap = signal<DrawerSnap>('default');

  protected readonly aiShortcuts: readonly ChatShortcut[] = [
    { id: 'pendencias', label: 'Quais são minhas pendências de hoje?' },
    { id: 'meta-nutricional', label: 'Pacientes fora da meta nutricional' },
  ];

  protected onAiShortcut(_: ChatShortcut): void {
    // Conduzir a conversa com a IA fica para quando o serviço de chat existir
    // — por enquanto só fecha o atalho selecionado, sem enviar nada de verdade.
  }

  protected onAiSend(_: string): void {
    // Ver onAiShortcut — mesma justificativa.
  }
}
