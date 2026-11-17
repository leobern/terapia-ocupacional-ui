import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

import { ViewportBreakpointService } from '../../services/viewport-breakpoint.service';
import { type ChatShortcut } from '../bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '../button/button.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { IconLogoComponent } from '../icon-logo/icon-logo.component';

/** Largura do painel. Lista fechada — ver spec.md § Altura e pontos de encaixe. */
export type DrawerSnap = 'default' | 'expanded';

/** Teto de atalhos renderizados (spec.md FR-012). Excedentes são ignorados. */
const MAX_SHORTCUTS = 3;

/** Reproduz o nó Figma `4412:5749`. Sem origem no Figma: `calc(100vw - var(--space-72))`
 *  (Desvio 2 — tela cheia menos o rail de navegação, `app-nav-menu`). `--space-72`, não
 *  `--space-80`: o rail encolheu para 72px (DS-component-menu, ajuste do usuário no Figma) —
 *  a referência antiga aqui tinha ficado desatualizada. */
const WIDTH_DEFAULT = '480px';
const WIDTH_EXPANDED = 'calc(100vw - var(--space-72))';
const WIDTH_CLOSED = '0px';

/**
 * Instâncias vivas de `app-drawer`. `--drawer-width` mora em
 * `document.documentElement` (é a única forma de alcançar irmãos no DOM — ver
 * docblock da classe), e propriedade global só tem um dono: com duas instâncias
 * montadas, o `onDestroy` de uma removia a variável que a outra ainda usa,
 * colapsando a margem do conteúdo sem nada ter fechado. O contador garante que a
 * limpeza só acontece quando a ÚLTIMA instância morre.
 */
let liveDrawerCount = 0;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DialogMode = 'closed' | 'non-modal' | 'modal';

/**
 * Drawer — o par de DESKTOP (`md`, ≥1200px) do `app-bottom-sheet` (DS-component-drawer,
 * nó Figma `4412:5749`). Mesma proposta de produto (chat da IA + atalhos rápidos), mas
 * painel fixo ancorado à direita em vez de superfície modal do rodapé.
 *
 * ## Por que `<dialog>` sempre com `show()`, nunca `showModal()` (mudou — ver nota abaixo)
 *
 * Versão anterior: `snap="expanded"` usava `showModal()` para ganhar de graça o foco
 * preso e o resto do documento inerte, via algoritmo nativo do `<dialog>`. Isso quebrou
 * um requisito real descoberto depois: `showModal()` promove o dialog ao TOP LAYER e
 * torna **absolutamente tudo fora dele** inerte — inclusive `app-nav-menu`, que precisa
 * continuar respondendo a `:hover`/`:focus-within` e abrir POR CIMA do drawer mesmo com
 * ele expandido (achado do usuário, DS-component-menu). Não existe opt-out por elemento
 * para essa inertização nativa — a única saída é não usar `showModal()`.
 *
 * Agora: sempre `.show()` (nunca modal nativo). O foco preso (FR-017) é implementado à
 * mão (`onKeydown`, Tab/Shift+Tab cicla dentro do dialog quando `isModal()`), e o
 * `inert` do conteúdo principal é aplicado pelo CONSUMIDOR só ao conteúdo roteado
 * (`app.component.ts`), nunca ao `app-nav-menu` — exatamente o que FR-019 já pedia
 * ("aplicar `inert` ao conteúdo principal da página", não ao documento inteiro). O
 * `z-index` do dialog (ver .scss) fica abaixo do `--z-index-overlay` do menu expandido,
 * de propósito, para o menu sempre ganhar a sobreposição visual.
 *
 * ## Por que o foco é capturado/restaurado à mão na troca de modo
 *
 * A restauração nativa do `<dialog>` ao `close()` foi desenhada para o ciclo completo
 * abrir→fechar, não para a troca de modo que expandir/recolher representa aqui —
 * depender dela arriscaria devolver o foco a um alvo fora do drawer (research.md §3).
 *
 * ## Por que `--drawer-width` é escrita em `document.documentElement`, não no host
 *
 * Uma custom property só é visível para o próprio elemento e seus descendentes — nunca
 * para irmãos por herança. O conteúdo que precisa receber a margem (`router-outlet`) é
 * IRMÃO do `app-drawer` no `app-shell`, então um binding no host nunca chegaria lá.
 * Escrever na raiz do documento torna a variável global e alcançável por qualquer
 * elemento da página (research.md §6) — mesma técnica que o `bottom-sheet` já usa para
 * `document.documentElement.style.overflow` (scroll lock), só que para uma custom
 * property em vez de uma propriedade padrão.
 *
 * ## Por que `Esc` nunca faz nada
 *
 * O drawer não tem caminho de dispensa por teclado além do próprio botão de fechar — o
 * evento `cancel` nativo (disparado pelo `Esc` quando o `<dialog>` é modal) é sempre
 * cancelado, em ambos os `snap` (spec.md § Clarifications).
 *
 * ## Uso
 *
 * ```html
 * @if (viewportBreakpoint.isDesktop()) {
 *   <app-drawer
 *     [open]="drawerOpen()"
 *     [snap]="drawerSnap()"
 *     [shortcuts]="shortcuts()"
 *     ariaLabel="Assistente de IA"
 *     (closed)="drawerOpen.set(false)"
 *     (snapChange)="drawerSnap.set($event)"
 *     (shortcutSelect)="askAssistant($event)"
 *   >
 *     <div drawerContent>...</div>
 *     <app-input-chat drawerFooter />
 *   </app-drawer>
 * }
 * ```
 *
 * O consumidor DEVE aplicar `margin-right: var(--drawer-width, 0px)` ao conteúdo da
 * página (FR-016) — o componente não move o conteúdo por conta própria, só expõe a
 * variável. Contrato completo em `specs/ds/DS-component-drawer/contracts/drawer-api.md`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent, IconLogoComponent],
  selector: 'app-drawer',
  styleUrl: './drawer.component.scss',
  templateUrl: './drawer.component.html',
})
export class DrawerComponent {
  /** Controlado pelo consumidor: o componente nunca escreve aqui (FR-002). */
  readonly open = input<boolean>(false);

  /** Controlado: o botão de expandir emite `(snapChange)`, quem grava é o consumidor. */
  readonly snap = input<DrawerSnap>('default');

  readonly showLogo = input<boolean>(true);

  /** Contextuais por conversa; no máximo 3 são renderizados (FR-012). */
  readonly shortcuts = input<readonly ChatShortcut[]>([]);

  /** `false` oculta o botão de fechar — único caminho de dispensa (FR-005). */
  readonly dismissible = input<boolean>(true);

  /** Obrigatório em ambos os `snap` — o drawer não tem título fixo. */
  readonly ariaLabel = input.required<string>();

  readonly closed = output();
  readonly snapChange = output<DrawerSnap>();
  readonly shortcutSelect = output<ChatShortcut>();

  protected readonly viewportBreakpoint = inject(ViewportBreakpointService);

  protected readonly visibleShortcuts = computed(() => this.shortcuts().slice(0, MAX_SHORTCUTS));

  protected readonly hasShortcuts = computed(() => this.visibleShortcuts().length > 0);

  /** `expanded` cobre a tela inteira exceto o rail — só aí faz sentido virar modal. */
  protected readonly isModal = computed(() => this.snap() === 'expanded');

  protected readonly roleAttr = computed(() => (this.isModal() ? 'dialog' : 'complementary'));

  protected readonly ariaModalAttr = computed<'true' | null>(() => (this.isModal() ? 'true' : null));

  protected readonly expandIcon = computed(() => (this.isModal() ? 'arrows-in' : 'arrows-out'));

  protected readonly expandLabel = computed(() => (this.isModal() ? 'Recolher' : 'Expandir'));

  private readonly drawerWidthPx = computed<string>(() => {
    if (!this.open()) {
      return WIDTH_CLOSED;
    }

    return this.isModal() ? WIDTH_EXPANDED : WIDTH_DEFAULT;
  });

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  /** Modo em que o `<dialog>` foi de fato aberto — fonte de verdade para saber se uma
   *  troca de modo (não só abrir/fechar) é necessária. */
  private dialogMode: DialogMode = 'closed';

  /** Capturado antes de expandir; restaurado ao recolher (research.md §3). */
  private preExpandFocusTarget: HTMLElement | null = null;

  constructor() {
    // Espelha `open`/`snap` no <dialog>, sempre via `.show()` (nunca `showModal()` — ver
    // docblock). O guard de desktop é a segunda camada de FR-013: o template já não
    // renderiza nada fora de `md`, mas se renderizasse, não abriria.
    effect(() => {
      const element = this.dialogRef()?.nativeElement;
      const shouldOpen = this.open() && this.viewportBreakpoint.isDesktop();
      const wantModal = this.isModal();

      if (!element) {
        return;
      }

      if (!shouldOpen) {
        if (this.dialogMode !== 'closed') {
          element.close();
          this.dialogMode = 'closed';
          this.preExpandFocusTarget = null;
        }

        return;
      }

      const wantMode: DialogMode = wantModal ? 'modal' : 'non-modal';

      if (this.dialogMode === wantMode) {
        return;
      }

      // `.show()` nos dois modos — a diferença entre `non-modal`/`modal` agora é só
      // semântica (foco preso a mão + `role`/`aria-modal`), não mecanismo do <dialog>.
      if (this.dialogMode === 'closed') {
        element.show();
      }

      if (wantMode === 'modal') {
        this.preExpandFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.dialogMode = 'modal';
        this.focusFirstFocusable(element);
      } else {
        this.dialogMode = 'non-modal';

        const target = this.preExpandFocusTarget;

        this.preExpandFocusTarget = null;
        target?.focus();
      }
    });

    // `--drawer-width` na raiz do documento: precisa alcançar irmãos do drawer no DOM,
    // que herança de custom property não faz a partir do próprio host (research.md §6).
    effect(() => {
      document.documentElement.style.setProperty('--drawer-width', this.drawerWidthPx());
    });

    liveDrawerCount += 1;

    inject(DestroyRef).onDestroy(() => {
      liveDrawerCount -= 1;

      if (liveDrawerCount === 0) {
        document.documentElement.style.removeProperty('--drawer-width');
      }
    });
  }

  /**
   * Foco preso manual (FR-017) — só entra em efeito com `isModal()`. Sem `showModal()`
   * não há mais captura nativa de `Tab`, então isso precisa ser feito à mão: `Tab` no
   * último focável volta pro primeiro, `Shift+Tab` no primeiro vai pro último. `Esc`
   * deliberadamente NÃO tem handler nenhum aqui — sem `showModal()` o browser não gera
   * nenhum evento especial para ele, e o drawer não tem caminho de dispensa por teclado
   * além do botão de fechar (spec.md § Clarifications) — já não é mais preciso cancelar
   * nada explicitamente.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.isModal()) {
      return;
    }

    const dialogEl = this.dialogRef()?.nativeElement;

    if (!dialogEl) {
      return;
    }

    const focusables = Array.from(dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      el => el.offsetParent !== null,
    );

    if (focusables.length === 0) {
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected onCloseClick(): void {
    this.dismiss();
  }

  protected onToggleExpand(): void {
    const next: DrawerSnap = this.snap() === 'default' ? 'expanded' : 'default';

    this.snapChange.emit(next);
  }

  protected onShortcut(shortcut: ChatShortcut): void {
    this.shortcutSelect.emit(shortcut);
  }

  /**
   * Único caminho de dispensa. Ordem de emissão importa ao fechar a partir de
   * `expanded`: `snapChange` ANTES de `closed` — mesmo motivo do `bottom-sheet`
   * (FR-025 de lá): sem isso, o consumidor poderia desmontar o drawer antes de gravar
   * o encaixe corrigido, e a próxima abertura reabriria expandida.
   */
  private dismiss(): void {
    if (!this.dismissible()) {
      return;
    }

    if (this.snap() !== 'default') {
      this.snapChange.emit('default');
    }

    this.closed.emit();
  }

  private focusFirstFocusable(dialogEl: HTMLDialogElement): void {
    dialogEl.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }
}
