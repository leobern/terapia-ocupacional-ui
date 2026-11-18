import { inject, Injectable, type Signal, signal } from '@angular/core';

import { recognizeAction, resolveAction } from './assistant-action-router';
import {
  ASSISTANT_QUERY_RESOLVERS,
  type AssistantAnswer,
  type AssistantQueryResolver,
  GENERIC_ERROR_MESSAGE,
  UNRECOGNIZED_ANSWER,
} from './assistant-query-resolver';
import { type ScreenAction, ScreenActionsService } from './screen-actions.service';

/**
 * O que o painel do assistente está mostrando:
 * - `chat`: saudação e perguntas rápidas (botão da logo / "Como eu posso te ajudar?");
 * - `shortcuts`: "Atalhos" — as ações da tela atual (botão de ações da tela);
 * - `form`: formulário em cards de uma ação de cadastro (padrão de cadastro);
 * - `unavailable`: ação listada que ainda não existe.
 */
export type AssistantView = 'chat' | 'shortcuts' | 'form' | 'unavailable';

/** Pergunta do profissional e o andamento da resposta (sem histórico entre aberturas do painel). */
export interface AssistantConversation {
  readonly question: string;
  readonly status: 'loading' | 'answered' | 'failed';
  readonly answer: AssistantAnswer | null;
}

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

  /** Última pergunta enviada (chip ou campo de mensagem); ponto de integração com o motor de IA. */
  readonly lastQuestion: Signal<string | null>;

  /** Conversa atual: `null` até a primeira pergunta; limpa a cada fechamento do painel. */
  readonly conversation: Signal<AssistantConversation | null>;

  private readonly screenActions = inject(ScreenActionsService);
  private readonly resolvers = inject(ASSISTANT_QUERY_RESOLVERS);
  private readonly conversationSignal = signal<AssistantConversation | null>(null);
  private requestId = 0;
  private readonly lastQuestionSignal = signal<string | null>(null);
  private readonly isOpenSignal = signal(false);
  private readonly viewSignal = signal<AssistantView>('chat');
  private readonly activeActionSignal = signal<ScreenAction | null>(null);

  constructor() {
    this.isOpen = this.isOpenSignal.asReadonly();
    this.lastQuestion = this.lastQuestionSignal.asReadonly();
    this.conversation = this.conversationSignal.asReadonly();
    this.view = this.viewSignal.asReadonly();
    this.activeAction = this.activeActionSignal.asReadonly();
  }

  /**
   * Único ponto de entrada de perguntas: usado pelos chips de sugestão e pelo campo de
   * mensagem (texto/áudio). Procura o resolvedor da intenção; sem nenhum, responde que ainda
   * não sabe. O motor de IA é outro escopo.
   */
  ask(question: string): void {
    const id = ++this.requestId;
    const resolver = this.resolvers.find(r => r.matches(question));

    this.lastQuestionSignal.set(question);

    // Pedido de ação (cadastro/movimentação): leva ao MESMO formulário do atalho de ações da tela
    // (padrão de cadastro). Só o que não é pedido de ação segue para os resolvedores de consulta.
    const known = recognizeAction(question);

    if (known) {
      this.conversationSignal.set(null);
      this.openAction(resolveAction(known, this.screenActions.actions()));

      return;
    }
    if (!resolver) {
      this.conversationSignal.set({ answer: UNRECOGNIZED_ANSWER, question, status: 'answered' });

      return;
    }
    this.conversationSignal.set({ answer: null, question, status: 'loading' });
    void this.settle(id, question, this.run(resolver, question));
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
    this.requestId++;
    this.lastQuestionSignal.set(null);
    this.conversationSignal.set(null);
    this.isOpenSignal.set(false);
    this.viewSignal.set('chat');
    this.activeActionSignal.set(null);
  }

  private async run(resolver: AssistantQueryResolver, question: string): Promise<AssistantAnswer> {
    return resolver.resolve(question);
  }

  private async settle(id: number, question: string, pending: Promise<AssistantAnswer>): Promise<void> {
    let next: AssistantConversation;

    try {
      next = { answer: await pending, question, status: 'answered' };
    } catch {
      next = { answer: { summary: GENERIC_ERROR_MESSAGE }, question, status: 'failed' };
    }
    if (id === this.requestId) {
      this.conversationSignal.set(next);
    }
  }

  private show(view: AssistantView, action: ScreenAction | null): void {
    this.viewSignal.set(view);
    this.activeActionSignal.set(action);
    this.isOpenSignal.set(true);
  }
}
