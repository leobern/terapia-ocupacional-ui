import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { KeyboardFocusService } from '../../services/keyboard-focus.service';
import { type Theme, ThemeService } from '../../services/theme.service';
import { ViewportBreakpointService } from '../../services/viewport-breakpoint.service';
// Avatar do DESIGN SYSTEM (`shared/components/avatar`), não o local de uma feature:
// `shared/` nunca importa de `features/` (Princípio IX). O import anterior apontava
// para `features/home/components/avatar`, diretório que nunca existiu no repositório —
// o build inteiro quebrava (achado do code review do PR #1).
import { AvatarComponent } from '../avatar/avatar.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { IconLogoButtonComponent } from '../icon-logo/icon-logo-button.component';

/** Mapeia as 6 chaves fixas dos itens de navegação (spec.md § Clarifications + Home). */
export type NavMenuItemKey = 'home' | 'farmacia' | 'pacientes' | 'tutorial' | 'vinculos';

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
/** Distância mínima do arrasto para a esquerda que fecha o menu no mobile. */
const SWIPE_CLOSE_PX = 56;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.nav-menu--open]': 'open()',
    '[class.nav-menu--suppressed]': 'suppressed()',
  },
  imports: [AvatarComponent, IconButtonComponent, IconLogoButtonComponent, PhIconComponent],
  selector: 'app-nav-menu',
  styleUrl: './nav-menu.component.scss',
  templateUrl: './nav-menu.component.html',
})
export class NavMenuComponent {
  readonly activeItem = input<NavMenuItemKey | null>(null);
  /** Itens sem acesso para o perfil atual: ficam desabilitados (ex.: Farmácia só para o gestor). */
  readonly disabledItems = input<readonly NavMenuItemKey[]>([]);

  /** Controlado pelo consumidor — só tem efeito visual abaixo de `md` (ver docblock). */
  readonly open = input<boolean>(false);

  readonly closed = output();
  /** Emitido ao clicar/ativar a logo — abre o assistente de IA (bottom-sheet/drawer, decisão do consumidor). */
  readonly logoClick = output();
  readonly homeClick = output();
  readonly farmaciaClick = output();
  readonly pacientesClick = output();
  readonly tutorialClick = output();
  readonly vinculosClick = output();
  readonly logoutClick = output();

  protected readonly professionalName = 'Michelle Franklin';
  protected readonly professionalRole = 'Nutróloga';

  protected readonly viewportBreakpoint = inject(ViewportBreakpointService);
  protected readonly themeService = inject(ThemeService);

  protected readonly themes: readonly { readonly icon: string; readonly label: string; readonly value: Theme }[] = [
    { icon: 'sun-dim', label: 'Tema claro', value: 'light' },
    { icon: 'moon', label: 'Tema escuro', value: 'dark' },
  ];

  /** Só oferece o botão de fechar fora do desktop — no desktop quem fecha é o mouse saindo do trilho. */
  protected readonly showCloseButton = computed(() => !this.viewportBreakpoint.isDesktop());

  // Ordem e ícones do Figma 4741:11339 (v2/NavRail). Ícones em peso "regular"; o item ativo é SÓLIDO ("fill").
  // Única exceção fixa: o ícone de Sair (template) é sempre bold, aberto ou fechado (CLAUDE.md).
  protected readonly items: readonly NavMenuItem[] = [
    // Home, Pacientes, Hospitais (os vínculos do profissional), Farmácia e Tutorial (Thiago, 2026-11-25).
    { icon: 'house', key: 'home', label: 'Home' },
    { icon: 'users-three', key: 'pacientes', label: 'Pacientes' },
    // Hospitais = vínculos com hospitais (US-001-2-02, RN03): sem desenho no Figma, ainda; pendente de aprovação.
    { icon: 'hospital', key: 'vinculos', label: 'Hospitais' },
    { icon: 'pill', key: 'farmacia', label: 'Farmácia' },
    { icon: 'graduation-cap', key: 'tutorial', label: 'Tutorial' },
  ];

  // Anel de foco sistêmico compartilhado por todos os controles clicáveis do
  // menu (logo, 4 itens, Sair) — um único signal booleano funciona porque
  // `:focus` já é escopado pelo browser ao elemento realmente focado; a classe
  // `.keyboard-focus` só entra em efeito combinada com `:focus` nativo (ver
  // shared/styles/_mixins.scss, mesmo padrão do Button/IconButton).
  protected readonly keyboardFocused = signal(false);
  /** Desktop: após clicar num item o menu recolhe até o mouse sair do trilho. */
  protected readonly suppressed = signal(false);

  private readonly keyboardFocusService = inject(KeyboardFocusService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private releaseListener: ((event: MouseEvent) => void) | null = null;
  private touchStart: { readonly x: number; readonly y: number } | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopListening());
  }

  protected onItemClick(key: NavMenuItemKey): void {
    this.collapseAfterClick();
    switch (key) {
      case 'home':
        this.homeClick.emit();
        break;
      case 'farmacia':
        this.farmaciaClick.emit();
        break;
      case 'pacientes':
        this.pacientesClick.emit();
        break;
      case 'tutorial':
        this.tutorialClick.emit();
        break;
      case 'vinculos':
        this.vinculosClick.emit();
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

  /** Mobile: arrastar o menu para a esquerda fecha (mais de 56px para o lado, sem desvio vertical maior). */
  protected onTouchStart(event: TouchEvent): void {
    this.touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  protected onTouchEnd(event: TouchEvent): void {
    const start = this.touchStart;

    this.touchStart = null;
    if (start === null || !this.open() || this.viewportBreakpoint.isDesktop()) {
      return;
    }
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;

    if (dx < -SWIPE_CLOSE_PX && Math.abs(dy) < Math.abs(dx)) {
      this.closed.emit();
    }
  }

  /** Recolhe o menu após a navegação: tira o foco do item e ignora o hover até o mouse sair do trilho. */
  private collapseAfterClick(): void {
    if (!this.viewportBreakpoint.isDesktop()) {
      return;
    }
    (document.activeElement as HTMLElement | null)?.blur();
    this.suppressed.set(true);
    this.stopListening();
    this.releaseListener = (event: MouseEvent): void => {
      if (event.clientX > this.host.nativeElement.getBoundingClientRect().right) {
        this.suppressed.set(false);
        this.stopListening();
      }
    };
    document.addEventListener('mousemove', this.releaseListener);
  }

  private stopListening(): void {
    if (this.releaseListener !== null) {
      document.removeEventListener('mousemove', this.releaseListener);
      this.releaseListener = null;
    }
  }
}
