import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';

import { ViewportKeyboardService } from '../../services/viewport-keyboard.service';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { IconLogoButtonComponent } from '../icon-logo/icon-logo-button.component';

/**
 * Barra de navegação inferior (DS-component-bottom-nav-bar, nó Figma `2265:1390`).
 *
 * Chassi de navegação de TODA tela em celular e tablet (`xs`/`sm`); em desktop
 * (`md`) ela se esconde sozinha e o `app-nav-menu` assume — os dois arquivos de
 * SCSS são leitura simétrica um do outro.
 *
 * Estrutura FIXA de 3 gatilhos, sem lista configurável e sem estado de item
 * ativo: o Figma não desenha nenhum dos dois, e inventá-los seria criar design
 * (spec.md § Clarifications, 2026-07-26). A barra emite intenções — abrir o menu
 * do sistema, o bottom-sheet da conversa com a IA e o bottom-sheet de ações da
 * tela ativa — e NUNCA navega nem monta as superfícies por conta própria; por
 * isso não injeta `Router`.
 *
 * Também não expõe `disabled` por slot: o visual `disabled` do `icon-button`
 * pinta um retângulo cinza, que destruiria o desenho chromeless da barra. Ação
 * ainda sem destino simplesmente não tem o evento conectado.
 *
 * Instância ÚNICA, montada pelo shell (`app.component.html`) — nunca por tela,
 * nunca dentro do `page-container` (contracts/bottom-nav-bar-api.md).
 */
/** Tempos da legenda do botão central (Thiago, 2026-11-25). */
export const FIRST_SUGGESTION_DELAY_MS = 3000;
export const SUGGESTION_INTERVAL_MS = 5000;
const ERASE_MS = 22;
const TYPE_MS = 34;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Com o teclado virtual aberto a barra sai do caminho: no iOS ela flutuaria
    // por cima do teclado, no Android cobriria o campo em foco (spec.md FR-015).
    '[class.bottom-nav-bar--hidden]': 'viewportKeyboard.isVirtualKeyboardOpen()',
  },
  imports: [IconButtonComponent, IconLogoButtonComponent],
  selector: 'app-bottom-nav-bar',
  styleUrl: './bottom-nav-bar.component.scss',
  templateUrl: './bottom-nav-bar.component.html',
})
export class BottomNavBarComponent {
  /**
   * Convite exibido sob o símbolo da IA. É **dinâmico por design**: o consumidor
   * troca o texto conforme a tela, o horário, a ação em curso ou um gatilho da
   * própria IA, para incentivar o acionamento. O default é o texto do Figma.
   *
   * Restrições: uma linha só, truncada com reticências se não couber no espaço
   * livre entre os botões laterais (ver o SCSS). Quebrar em duas linhas
   * empurraria o símbolo para cima e desfaria o transbordo de 8px do desenho —
   * então o texto precisa ser curto por escrita, não por corte.
   */
  readonly aiLabel = input<string>('Como posso ajudar?'); // Figma v2/BottomNav

  /**
   * Sugestões da tela (Thiago, 2026-11-25): a legenda começa em `aiLabel`, depois de 3 s apaga e digita a primeira sugestão e
   * segue trocando a cada 5 s (apaga para o meio e digita de novo, texto centralizado), voltando ao `aiLabel` no fim da lista.
   */
  readonly suggestions = input<readonly string[]>([]);

  /**
   * Estado das superfícies que a barra abre, informado pelo consumidor (quem as
   * monta é ele). Existem só para alimentar `aria-expanded` — nenhum efeito
   * visual.
   *
   * O passthrough que faltava (`ariaExpanded` em `app-icon-button` e
   * `app-icon-logo-button`) foi implementado no code review do PR #1: as três
   * props agora chegam de fato ao `<button>` interno, fechando spec.md FR-016.
   * Prop pública que não faz nada é pior que prop ausente (Princípio X).
   */
  readonly menuOpen = input<boolean>(false);
  readonly aiOpen = input<boolean>(false);
  readonly actionsOpen = input<boolean>(false);

  // `output()` sem argumento de tipo (e não `output<void>()`): os eventos não
  // carregam payload — mesma convenção já usada em `IconLogoButtonComponent`.
  readonly menuClick = output();
  /** Emite o índice da sugestão visível (-1 = o convite padrão); a tela decide o que executar. */
  readonly aiClick = output<number>();
  readonly actionsClick = output();

  /**
   * Rótulos acessíveis fixos (spec.md § Acessibilidade). Não são inputs: os 3
   * botões sempre significam a mesma coisa, em qualquer tela, e deixar a tela
   * renomeá-los abriria espaço para navegação inconsistente entre telas.
   */
  protected readonly menuLabel = 'Abrir menu';
  protected readonly aiButtonLabel = 'Abrir assistente de IA';
  protected readonly actionsLabel = 'Ações desta tela';

  protected readonly viewportKeyboard = inject(ViewportKeyboardService);

  /** Texto exibido agora (muda por digitação). */
  protected readonly shown = signal('');

  private readonly destroyRef = inject(DestroyRef);
  private currentIndex = -1;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      this.start(this.aiLabel(), this.suggestions());
    });
    this.destroyRef.onDestroy(() => clearTimeout(this.timer));
  }

  protected onAiClick(): void {
    this.aiClick.emit(this.currentIndex);
  }

  /** Reinicia o ciclo: convite padrão agora, primeira sugestão em 3 s e uma nova a cada 5 s. */
  private start(idle: string, suggestions: readonly string[]): void {
    clearTimeout(this.timer);
    this.currentIndex = -1;
    this.shown.set(idle);
    if (suggestions.length === 0) {
      return;
    }
    const labels = [idle, ...suggestions];
    let position = 0;
    const next = (): void => {
      position = (position + 1) % labels.length;
      this.currentIndex = position - 1;
      this.swap(labels[position], () => {
        this.timer = setTimeout(next, SUGGESTION_INTERVAL_MS);
      });
    };

    this.timer = setTimeout(next, FIRST_SUGGESTION_DELAY_MS);
  }

  /** Apaga o texto atual (as letras somem para o meio, o texto é centralizado) e digita o novo. */
  private swap(text: string, done: () => void): void {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.shown.set(text);
      done();

      return;
    }
    const type = (count: number): void => {
      this.shown.set(text.slice(0, count));
      if (count < text.length) {
        this.timer = setTimeout(() => type(count + 1), TYPE_MS);
      } else {
        done();
      }
    };

    const erase = (): void => {
      const current = this.shown();

      if (current.length > 0) {
        this.shown.set(current.slice(0, -1));
        this.timer = setTimeout(erase, ERASE_MS);

        return;
      }
      type(0);
    };

    erase();
  }
}
