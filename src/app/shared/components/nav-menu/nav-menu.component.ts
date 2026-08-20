import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { KeyboardFocusService } from '../../services/keyboard-focus.service';
import { ViewportBreakpointService } from '../../services/viewport-breakpoint.service';
// Avatar do DESIGN SYSTEM (`shared/components/avatar`), não o local de uma feature:
// `shared/` nunca importa de `features/` (Princípio IX). O import anterior apontava
// para `features/home/components/avatar`, diretório que nunca existiu no repositório —
// o build inteiro quebrava (achado do code review do PR #1).
import { AvatarComponent } from '../avatar/avatar.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { IconLogoButtonComponent } from '../icon-logo/icon-logo-button.component';

/** Mapeia as 5 chaves fixas dos itens de navegação (spec.md § Clarifications). */
export type NavMenuItemKey = 'hospitais' | 'farmacia' | 'pacientes' | 'acoes-tela' | 'notificacoes';

interface NavMenuItem {
  readonly key: NavMenuItemKey;
  readonly label: string;
  readonly icon: string;
}

/**
 * Menu de navegação — dois modos, mesmo componente e mesmo DOM.
 *
 * Desktop (breakpoint-md, >=1200px — Figma node 4334:7401): trilho de 72px
 * que expande para 280px ao passar o mouse OU ao receber foco por teclado
 * (`:focus-within` — spec.md FR-011). O painel expandido flutua por cima do
 * conteúdo da rota (`position: absolute`) em vez de empurrá-lo — o `:host`
 * reserva sempre 72px no layout.
 *
 * Mobile/tablet (<1200px — Figma node 4367:11591, "menu aberto"): o `:host`
 * não ocupa espaço nenhum no layout (a navegação é a bottom-nav-bar); o
 * painel fica fora da tela por padrão e desliza a partir da esquerda quando
 * `open()` é `true`, controlado pelo consumidor via o botão "Menu" da
 * bottom-nav-bar — mesma transição de largura/fade dos rótulos que o hover
 * de desktop usa, só que disparada por `open()` em vez de `:hover`/
 * `:focus-within`. Fecha só pelo botão "X" (sem esconder ao tocar fora —
 * não há scrim no Figma) ou por `closed()`.
 *
 * A logo (`app-icon-logo-button`) nunca troca de componente nem de posição;
 * só a cor de acento (primary→secondary) e o wordmark ao lado mudam. Clicar
 * nela emite `logoClick` — o consumidor decide o que fazer (abrir o
 * assistente de IA, mesmo padrão do botão de IA da bottom-nav-bar).
 *
 * `activeItem` marca o item correspondente à rota atual — enum de 4 chaves fixas,
 * não uma string de rota livre: o componente não conhece o formato de rota do app
 * consumidor (spec.md § Clarifications).
 *
 * NOTA: mesmo placeholder de sessão/perfil ainda inexistente usado em
 * home.component.ts (não há serviço de sessão no frontend por enquanto).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.nav-menu--open]': 'open()',
  },
  imports: [AvatarComponent, IconButtonComponent, IconLogoButtonComponent, PhIconComponent],
  selector: 'app-nav-menu',
  styleUrl: './nav-menu.component.scss',
  templateUrl: './nav-menu.component.html',
})
export class NavMenuComponent {
  readonly activeItem = input<NavMenuItemKey | null>(null);

  /** Controlado pelo consumidor — só tem efeito visual abaixo de `md` (ver docblock). */
  readonly open = input<boolean>(false);

  readonly closed = output();
  /** Emitido ao clicar/ativar a logo — abre o assistente de IA (bottom-sheet/drawer, decisão do consumidor). */
  readonly logoClick = output();
  readonly hospitaisClick = output();
  readonly farmaciaClick = output();
  readonly pacientesClick = output();
  readonly acoesTelaClick = output();
  readonly notificacoesClick = output();
  readonly logoutClick = output();

  protected readonly professionalName = 'Michelle Franklin';
  protected readonly professionalRole = 'Nutróloga';

  protected readonly viewportBreakpoint = inject(ViewportBreakpointService);

  /** Só oferece o botão de fechar fora do desktop — no desktop quem fecha é o mouse saindo do trilho. */
  protected readonly showCloseButton = computed(() => !this.viewportBreakpoint.isDesktop());

  // Ícones sempre em peso "regular" (não o "bold" padrão do design system) —
  // decisão específica deste componente (spec.md § Clarifications).
  protected readonly items: readonly NavMenuItem[] = [
    { icon: 'hospital', key: 'hospitais', label: 'Hospitais' },
    { icon: 'pill', key: 'farmacia', label: 'Farmácia' },
    { icon: 'users-four', key: 'pacientes', label: 'Pacientes' },
    { icon: 'squares-four', key: 'acoes-tela', label: 'Ações da tela' },
    { icon: 'bell', key: 'notificacoes', label: 'Notificações' },
  ];

  // Anel de foco sistêmico compartilhado por todos os controles clicáveis do
  // menu (logo, 4 itens, Sair) — um único signal booleano funciona porque
  // `:focus` já é escopado pelo browser ao elemento realmente focado; a classe
  // `.keyboard-focus` só entra em efeito combinada com `:focus` nativo (ver
  // shared/styles/_mixins.scss, mesmo padrão do Button/IconButton).
  protected readonly keyboardFocused = signal(false);

  private readonly keyboardFocusService = inject(KeyboardFocusService);

  protected onItemClick(key: NavMenuItemKey): void {
    switch (key) {
      case 'hospitais':
        this.hospitaisClick.emit();
        break;
      case 'farmacia':
        this.farmaciaClick.emit();
        break;
      case 'pacientes':
        this.pacientesClick.emit();
        break;
      case 'acoes-tela':
        this.acoesTelaClick.emit();
        break;
      case 'notificacoes':
        this.notificacoesClick.emit();
        break;
    }
  }

  protected onFocus(): void {
    this.keyboardFocused.set(this.keyboardFocusService.isKeyboard());
  }

  protected onBlur(): void {
    this.keyboardFocused.set(false);
  }

  protected onCloseClick(): void {
    this.closed.emit();
  }
}
