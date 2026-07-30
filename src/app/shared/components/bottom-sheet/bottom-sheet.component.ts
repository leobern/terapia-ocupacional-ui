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
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { ViewportBreakpointService } from '../../services/viewport-breakpoint.service';
import { ViewportKeyboardService } from '../../services/viewport-keyboard.service';
import { ButtonComponent } from '../button/button.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { IconLogoComponent } from '../icon-logo/icon-logo.component';

/** Ponto de encaixe do sheet. Lista fechada — ver spec.md § Altura e pontos de encaixe. */
export type BottomSheetSnap = 'default' | 'full';

/** Atalho rápido da faixa `actions`. Contextual por conversa; nunca fixo. */
export interface ChatShortcut {
  readonly id: string;
  readonly label: string;
}

/** Teto de atalhos renderizados (spec.md FR-023). Excedentes são ignorados. */
const MAX_SHORTCUTS = 3;

/** Fração da altura visível do sheet que o arraste precisa cruzar para comprometer. */
const COMMIT_THRESHOLD_RATIO = 0.25;

/** Velocidade (px/ms) que vence o limiar de posição — o "flick". */
const COMMIT_VELOCITY_PX_PER_MS = 0.5;

/** Opacidade mínima do scrim no fim do arraste de dispensa. */
const SCRIM_MIN_OPACITY = 0.2;

/**
 * Bottom sheet — a ÚNICA superfície modal do produto em celular e tablet
 * (DS-component-bottom-sheet, nó Figma `4412:5973`).
 *
 * É um chassi: cabeçalho fixo de arraste (logo + alça + fechar), região de
 * conteúdo rolável projetada e rodapé projetado. Quem monta a conversa da IA ou o
 * menu de ações é o consumidor — por isso não existe prop `variant` (spec.md
 * § Clarifications, Q1) e por isso FR-011 proíbe o componente de enviar mensagem
 * ou chamar a IA.
 *
 * ## Por que `<dialog>` e não `position: fixed`
 *
 * `showModal()` promove o elemento ao top layer, o que resolve de uma vez quatro
 * coisas que seriam trabalho manual e frágil: escapa de contexto de empilhamento,
 * prende o foco, restaura o foco ao fechar e torna o resto da página inerte. O
 * primeiro item não é hipotético neste projeto — `page-container` aplica
 * `transform` + `filter: blur(100px)` e `background-mesh` aplica
 * `filter: blur(160px)`, e cada um cria um *containing block* que capturaria um
 * `position: fixed` descendente.
 *
 * Consequência: o `z-index: var(--z-index-overlay)` no SCSS é inócuo no top layer.
 * Ele fica aplicado de propósito (custo zero, cobre o caminho não-modal e mantém a
 * letra de FR-015) — não é superstição.
 *
 * ## Por que o cabeçalho não é projetável
 *
 * Ele é a superfície de arraste. Abri-lo permitiria a um consumidor remover a alça
 * e quebrar o gesto em silêncio.
 *
 * ## Por que a rolagem do documento é travada à mão
 *
 * É o único dos quatro problemas acima que o `<dialog>` NÃO resolve.
 *
 * ## Uso
 *
 * O `@if` é obrigação do consumidor (SC-009 exige ausência do DOM em `md`); o
 * componente ainda assim se protege sozinho, então esquecer o `@if` degrada para
 * "invisível e inerte", nunca para um modal aberto no desktop.
 *
 * ```html
 * @if (!viewportBreakpoint.isDesktop()) {
 *   <app-bottom-sheet
 *     [open]="sheetOpen()"
 *     [snap]="sheetSnap()"
 *     [shortcuts]="shortcuts()"
 *     ariaLabel="Assistente de IA"
 *     (closed)="sheetOpen.set(false)"
 *     (snapChange)="sheetSnap.set($event)"
 *     (shortcutSelect)="askAssistant($event)"
 *   >
 *     <div bottomSheetContent>...</div>
 *     <app-input-chat bottomSheetFooter />
 *   </app-bottom-sheet>
 * }
 * ```
 *
 * O consumidor DEVE gravar `(snapChange)` — sem isso o encaixe não persiste e a
 * reabertura em `default` (FR-025) não acontece. Contrato completo em
 * `specs/ds/DS-component-bottom-sheet/contracts/bottom-sheet-api.md`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent, IconLogoComponent],
  selector: 'app-bottom-sheet',
  styleUrl: './bottom-sheet.component.scss',
  templateUrl: './bottom-sheet.component.html',
})
export class BottomSheetComponent {
  /** Controlado pelo consumidor: o componente nunca escreve aqui (FR-002). */
  readonly open = input<boolean>(false);

  /** Controlado: o arraste emite `(snapChange)`, quem grava o valor é o consumidor. */
  readonly snap = input<BottomSheetSnap>('default');

  readonly showLogo = input<boolean>(true);

  /** Contextuais por conversa; no máximo 3 são renderizados (FR-023). */
  readonly shortcuts = input<readonly ChatShortcut[]>([]);

  /**
   * `false` remove o `X` e desativa scrim, `Esc` e arraste-para-fechar — mas NÃO o
   * arraste entre encaixes, que não dispensa nada.
   */
  readonly dismissible = input<boolean>(true);

  /** Obrigatório: o sheet não tem título fixo, então é a única identificação para AT. */
  readonly ariaLabel = input.required<string>();

  readonly closed = output();
  readonly snapChange = output<BottomSheetSnap>();
  readonly shortcutSelect = output<ChatShortcut>();

  protected readonly viewportBreakpoint = inject(ViewportBreakpointService);

  protected readonly visibleShortcuts = computed(() => this.shortcuts().slice(0, MAX_SHORTCUTS));

  protected readonly hasShortcuts = computed(() => this.visibleShortcuts().length > 0);

  /**
   * O teclado virtual força `full` sem sobrescrever a prop do consumidor: o valor
   * derivado governa o visual, e o `(snapChange)` correspondente é emitido para o
   * consumidor acompanhar (FR-018).
   */
  protected readonly effectiveSnap = computed<BottomSheetSnap>(() =>
    this.viewportKeyboard.isVirtualKeyboardOpen() ? 'full' : this.snap(),
  );

  protected readonly dragOffsetPx = signal(0);

  protected readonly isDragging = signal(false);

  /**
   * Fração do caminho de dispensa já percorrida pelo arraste (0..1), medida contra
   * a altura visível do sheet. Existe separada de `dragOffsetPx` porque o scrim
   * precisa dela como razão, não como pixels, e porque a altura do gesto é um
   * campo comum — não um sinal — para não haver leitura de layout no `pointermove`.
   */
  protected readonly dragProgress = signal(0);

  protected readonly keyboardInsetPx = computed(() => this.viewportKeyboard.keyboardInsetPx());

  /**
   * Deslocamento do arraste como estilo inline. `null` fora do gesto devolve o
   * controle às classes do SCSS.
   *
   * Vai por inline, e não por custom property no CSS, de propósito: com
   * `translate: 0 var(--drag, 0px)` na regra `[open]`, o Chrome não reavalia a
   * propriedade quando `showModal()` acrescenta o atributo `[open]` — o sheet
   * abria invisível, empurrado 100% abaixo da viewport, e só recalculava ao mexer
   * em alguma custom property inline. Valor literal no CSS + inline no gesto
   * elimina a classe de bug inteira.
   */
  protected readonly dragTranslate = computed(() => (this.isDragging() ? `0 ${this.dragOffsetPx()}px` : null));

  /**
   * Opacidade do scrim durante o arraste de dispensa: ele clareia à medida que o
   * sheet desce, sinalizando que soltar dispensa (spec.md § Interações & Motion).
   *
   * `null` fora do gesto devolve o controle ao CSS. O fallback da custom property
   * no SCSS é `1`, então se o `::backdrop` não herdar o valor num navegador o
   * comportamento degrada para o scrim opaco de sempre — nunca para invisível.
   */
  protected readonly scrimOpacity = computed(() =>
    this.isDragging() ? `${1 - this.dragProgress() * (1 - SCRIM_MIN_OPACITY)}` : null,
  );

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  private readonly viewportKeyboard = inject(ViewportKeyboardService);

  /**
   * Estado do gesto em curso, ou `null` fora dele. Um objeto único (em vez de
   * campos soltos) porque os quatro dados nascem e morrem juntos: com campos
   * separados, cada handler precisava do próprio guard de nulidade e apareciam
   * ramos que nenhum gesto real alcança.
   *
   * `heightPx` é a altura visível medida no `pointerdown` — base dos limiares de
   * posição, lida uma vez para não haver leitura de layout no `pointermove`.
   */
  private drag: { heightPx: number; lastTime: number; lastY: number; startY: number } | null = null;

  /** `overflow` original do documento, restaurado ao destravar. */
  private previousOverflow: string | null = null;

  constructor() {
    // Espelha `open` no <dialog>. O guard de desktop é a segunda camada de FR-014:
    // o template já não renderiza nada em `md`, mas se renderizasse, não abriria.
    effect(() => {
      const element = this.dialogRef()?.nativeElement;
      const shouldOpen = this.open() && !this.viewportBreakpoint.isDesktop();

      if (!element) {
        this.releaseScroll();

        return;
      }

      if (shouldOpen && !element.open) {
        element.showModal();
        this.lockScroll();
      } else if (!shouldOpen && element.open) {
        element.close();
        this.releaseScroll();
      }
    });

    // Avisa o consumidor quando o teclado virtual muda o encaixe efetivo. A
    // comparação com `snap()` torna a emissão idempotente: assim que o consumidor
    // grava o valor, o efeito reexecuta e não emite de novo.
    effect(() => {
      const effective = this.effectiveSnap();

      if (untracked(() => this.open()) && effective !== untracked(() => this.snap())) {
        this.snapChange.emit(effective);
      }
    });

    // Destravar aqui, e não só no caminho de fechamento: um sheet destruído sem
    // transição (navegação de rota) deixaria a página travada para sempre (FR-007).
    inject(DestroyRef).onDestroy(() => this.releaseScroll());
  }

  /**
   * Clique no `::backdrop` chega ao DOM com o próprio `<dialog>` como alvo — é
   * assim que o navegador reporta, e é o que distingue scrim de conteúdo.
   */
  protected onDialogClick(event: MouseEvent): void {
    // O `<dialog>` só é alvo direto de clique quando o ponteiro cai no backdrop:
    // qualquer toque no conteúdo tem um descendente como alvo.
    if (event.target instanceof HTMLDialogElement) {
      this.dismiss();
    }
  }

  /**
   * `Esc` nativo. Sempre cancelado e reencaminhado por `dismiss()`, para os quatro
   * caminhos de dispensa passarem pelo mesmo funil — sem isso, `dismissible=false`
   * seria ignorado pelo teclado.
   */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.dismiss();
  }

  protected onCloseClick(): void {
    this.dismiss();
  }

  protected onShortcut(shortcut: ChatShortcut): void {
    this.shortcutSelect.emit(shortcut);
  }

  protected onPointerDown(event: PointerEvent): void {
    const element = this.dialogRef()?.nativeElement;

    if (!element) {
      return;
    }

    this.drag = {
      heightPx: element.getBoundingClientRect().height,
      lastTime: event.timeStamp,
      lastY: event.clientY,
      startY: event.clientY,
    };

    this.isDragging.set(true);
    this.dragOffsetPx.set(0);

    // Mantém os eventos chegando se o dedo sair do cabeçalho no meio do gesto.
    // Falha com ponteiro sintético (testes), onde o `pointerId` não está ativo.
    try {
      (event.target as Element).setPointerCapture(event.pointerId);
    } catch {
      /* ponteiro sintético — o gesto continua funcionando pelos listeners do cabeçalho */
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;

    if (!drag) {
      return;
    }

    const delta = event.clientY - drag.startY;

    drag.lastTime = event.timeStamp;
    drag.lastY = event.clientY;

    // O sheet acompanha o dedo só PARA BAIXO. Para cima ele não desloca nada, e
    // isso não é resistência estética: o container é ancorado no rodapé com altura
    // fixa por encaixe, então qualquer deslocamento para cima abriria uma faixa
    // vazia embaixo dele. O gesto ascendente continua sendo reconhecido — ele
    // comanda a expansão para `full` no `commitDrag`, que lê o delta bruto.
    const offset = Math.max(0, delta);

    // Nenhuma leitura de layout aqui (a altura foi medida no `pointerdown`): só
    // `translate` e a opacidade do scrim, para o gesto ficar no compositor
    // (plan.md § Performance Goals).
    this.dragOffsetPx.set(offset);
    this.dragProgress.set(drag.heightPx > 0 ? Math.min(1, offset / drag.heightPx) : 0);
  }

  protected onPointerUp(event: PointerEvent): void {
    const drag = this.drag;

    if (!drag) {
      return;
    }

    const delta = event.clientY - drag.startY;
    const elapsed = event.timeStamp - drag.lastTime;

    // Velocidade da ÚLTIMA amostra, não do gesto inteiro: a média do arraste todo
    // subestima o "flick" final, que é justamente o que o usuário usa para
    // comprometer o gesto sem percorrer a distância toda.
    const velocity = elapsed > 0 ? (event.clientY - drag.lastY) / elapsed : 0;

    this.endDrag();
    this.commitDrag(delta, velocity, drag.heightPx);
  }

  /** Interrupção do sistema (chamada recebida): volta ao encaixe de origem. */
  protected onPointerCancel(): void {
    this.endDrag();
  }

  private endDrag(): void {
    this.drag = null;
    this.isDragging.set(false);
    this.dragOffsetPx.set(0);
    this.dragProgress.set(0);
  }

  private commitDrag(delta: number, velocity: number, heightPx: number): void {
    const committed =
      Math.abs(delta) > heightPx * COMMIT_THRESHOLD_RATIO || Math.abs(velocity) > COMMIT_VELOCITY_PX_PER_MS;

    if (!committed) {
      return;
    }

    const current = this.effectiveSnap();

    if (delta < 0) {
      if (current === 'default') {
        this.snapChange.emit('full');
      }

      return;
    }

    // Para baixo a partir de `full` RECOLHE, nunca fecha direto (FR-021): um gesto
    // longo a partir da tela cheia não deve dispensar a conversa inteira.
    if (current === 'full') {
      this.snapChange.emit('default');

      return;
    }

    this.dismiss();
  }

  /**
   * Funil único de dispensa: `X`, scrim, `Esc` e arraste passam todos por aqui, e
   * é o que garante que `dismissible=false` bloqueie os quatro de uma vez.
   *
   * A ordem importa — `snapChange` ANTES de `closed`. Com `closed` primeiro, o
   * consumidor poderia desmontar antes de receber a correção do encaixe e reabrir
   * expandido, que é exatamente o que FR-025 existe para evitar.
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

  // Sem guard de "já travado": o efeito só chama isto na transição para aberto
  // (`shouldOpen && !element.open`), então uma segunda chamada seguida é
  // inalcançável — um guard aqui seria ramo morto, não defesa.
  private lockScroll(): void {
    this.previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
  }

  private releaseScroll(): void {
    if (this.previousOverflow === null) {
      return;
    }

    document.documentElement.style.overflow = this.previousOverflow;
    this.previousOverflow = null;
  }
}
