import { Injectable, type Signal, signal } from '@angular/core';

import { type ScreenAction } from './screen-actions.service';

/**
 * O que o painel do assistente está mostrando:
 * - `chat`: saudação e perguntas rápidas (botão da logo / "Como eu posso te ajudar?");
 * - `shortcuts`: "Atalhos" — as ações da tela atual (botão de ações da tela);
 * - `form`: formulário em cards de uma ação de cadastro (padrão de cadastro);
 * - `unavailable`: ação listada que ainda não existe.
 */
export type AssistantView = 'chat' | 'shortcuts' | 'form' | 'unavailable';

/**
 * Estado do assistente de IA — compartilhado entre o shell da aplicação (que monta
 * `app-drawer`/`app-bottom-sheet`, únicos, em `app.component.html`) e qualquer tela que
 * precise abrir o painel (ex.: botão de atalhos do cabeçalho da Home).
 *
 * Um serviço em vez de `@Output` porque não existe caminho de evento entre uma tela
 * roteada e `app.component` — o `<router-outlet>` não propaga eventos do componente filho
 * para o pai. Mesmo formato dos outros serviços de estado do app
 * (`ViewportBreakpointService`, `KeyboardFocusService`): `providedIn: 'root'`, sinal
 * privado + `Signal` público somente leitura.
 */
@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  readonly isOpen: Signal<boolean>;
  readonly view: Signal<AssistantView>;
  /** Ação cujo formulário (ou aviso) está aberto; `null` fora dessas visões. */
  readonly activeAction: Signal<ScreenAction | null>;

  private readonly isOpenSignal = signal(false);
  private readonly viewSignal = signal<AssistantView>('chat');
  private readonly activeActionSignal = signal<ScreenAction | null>(null);

  constructor() {
    this.isOpen = this.isOpenSignal.asReadonly();
    this.view = this.viewSignal.asReadonly();
    this.activeAction = this.activeActionSignal.asReadonly();
  }

  /** Abre o painel no chat (saudação). */
  openPanel(): void {
    this.show('chat', null);
  }

  /** Abre o painel nas ações da tela atual ("Atalhos"). */
  openShortcuts(): void {
    this.show('shortcuts', null);
  }

  /** Abre a ação escolhida: formulário se for um cadastro, aviso se ainda não existir. */
  openAction(action: ScreenAction): void {
    this.show(action.form ? 'form' : 'unavailable', action);
  }

  /** Volta de um formulário/aviso para as ações da tela. */
  back(): void {
    this.show('shortcuts', null);
  }

  closePanel(): void {
    this.isOpenSignal.set(false);
    this.viewSignal.set('chat');
    this.activeActionSignal.set(null);
  }

  private show(view: AssistantView, action: ScreenAction | null): void {
    this.viewSignal.set(view);
    this.activeActionSignal.set(action);
    this.isOpenSignal.set(true);
  }
}
