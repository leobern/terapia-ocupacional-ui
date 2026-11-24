import { Injectable, type Signal, signal } from '@angular/core';

import { type DirectoryUser } from './user-directory';

/**
 * PADRÃO DE CADASTRO (docs/regras-de-negocio/padrao-de-cadastro.md)
 *
 * Cada tela declara as AÇÕES que oferece (`ScreenAction`). O botão de atalhos abre o
 * assistente numa primeira tela com essas ações; ao escolher uma que é um cadastro
 * (`form`), o painel vira um formulário em cards — um card por pergunta
 * (`FormFieldDefinition`). Hoje o preenchimento é manual; o mesmo formulário será
 * conduzido por conversa no futuro, por isso o formulário é DADO (definição), não markup.
 */

/** Tipos de campo suportados nos cards do formulário. */
export type FormFieldKind = 'mention' | 'text' | 'date';

/** Valor de um campo: `mention` guarda os usuários marcados; `text`/`date` guardam texto (data ISO `yyyy-MM-dd`). */
export type FormFieldValue = string | readonly DirectoryUser[];

export type FormValues = Readonly<Record<string, FormFieldValue>>;

export interface FormFieldDefinition {
  readonly id: string;
  /** Pergunta exibida no cabeçalho do card. */
  readonly label: string;
  readonly kind: FormFieldKind;
  readonly placeholder: string;
  readonly required: boolean;
}

export interface FormActionDefinition {
  /** Título do painel enquanto o formulário está aberto (ex.: "Criar notificação"). */
  readonly title: string;
  readonly submitLabel: string;
  readonly fields: readonly FormFieldDefinition[];
  /** Placeholder do campo de mensagem/áudio do rodapé (ex.: "Fale ou escreva a notificação"). */
  readonly messagePlaceholder?: string;
  /**
   * Sugestões inteligentes (chips acima do campo de mensagem), calculadas pela IA a partir do histórico. Ausente ou
   * vazio = a área não aparece (V1 sem IA).
   */
  readonly suggestions?: readonly string[];
  /** Persiste o cadastro. Lançar erro mantém o formulário aberto com os dados. */
  readonly submit: (values: FormValues) => Promise<void> | void;
}

export interface ScreenAction {
  readonly id: string;
  readonly label: string;
  /** Ausente = ação ainda não disponível (o painel avisa em vez de abrir um formulário). */
  readonly form?: FormActionDefinition;
  /** Ação de navegação (fluxo de outra feature): o painel fecha e `navigate` leva ao destino; sem formulário. */
  readonly navigate?: () => void;
}

/** Opção de ordenação pré-definida oferecida como chip no painel de Atalhos. */
export interface ScreenSortOption {
  readonly id: string;
  readonly label: string;
}

/** Ordenação declarada pela tela: só um critério ativo por vez (`active`); `select` aplica localmente. */
export interface ScreenSortDefinition {
  readonly options: readonly ScreenSortOption[];
  readonly active: Signal<string | null>;
  readonly select: (id: string) => void;
}

/**
 * Texto do assistente para a tela atual (a tela de Notificações fala de notificações, a de Pacientes de pacientes...).
 * O painel o mostra no lugar da saudação genérica; sem contexto registrado, usa a saudação padrão.
 */
export interface ScreenContext {
  /** Título (ex.: "Como posso ajudar nas notificações?"). */
  readonly title: string;
  /** Texto descritivo das ações da tela, escrito como a IA se apresentando para aquela tela. */
  readonly description: string;
}

/** Comando livre do profissional (texto ou áudio gravado) a encaminhar à camada de IA da tela. */
export type ScreenCommand =
  { readonly kind: 'text'; readonly text: string } | { readonly kind: 'audio'; readonly audio: Blob };

/** Encaminha o comando à camada de IA; rejeitar significa "IA indisponível". A tela não interpreta o comando. */
export type ScreenCommandHandler = (command: ScreenCommand) => Promise<void>;

/**
 * Registro das ações da tela atual. A tela chama `register()` ao iniciar e o cleanup
 * devolvido ao destruir — o assistente só lê `actions()`.
 */
@Injectable({ providedIn: 'root' })
export class ScreenActionsService {
  readonly actions: Signal<readonly ScreenAction[]>;

  readonly sort: Signal<ScreenSortDefinition | null>;

  /** Texto do assistente para a tela atual; `null` = saudação genérica. */
  readonly context: Signal<ScreenContext | null>;

  /** Quando a tela registra um handler, mensagens do assistente são encaminhadas a ele, sem interpretação local. */
  readonly commandHandler: Signal<ScreenCommandHandler | null>;

  private readonly commandSignal = signal<ScreenCommandHandler | null>(null);
  private readonly contextSignal = signal<ScreenContext | null>(null);
  private readonly actionsSignal = signal<readonly ScreenAction[]>([]);
  private readonly sortSignal = signal<ScreenSortDefinition | null>(null);

  constructor() {
    this.actions = this.actionsSignal.asReadonly();
    this.sort = this.sortSignal.asReadonly();
    this.context = this.contextSignal.asReadonly();
    this.commandHandler = this.commandSignal.asReadonly();
  }

  /** Registra o encaminhamento de comandos de IA da tela; o cleanup só remove se ainda for o atual. */
  registerCommandHandler(handler: ScreenCommandHandler): () => void {
    this.commandSignal.set(handler);

    return (): void => {
      if (this.commandSignal() === handler) {
        this.commandSignal.set(null);
      }
    };
  }

  /** Registra o texto do assistente para a tela; o cleanup só remove se ainda for o atual. */
  registerContext(context: ScreenContext): () => void {
    this.contextSignal.set(context);

    return (): void => {
      if (this.contextSignal() === context) {
        this.contextSignal.set(null);
      }
    };
  }

  /** Registra a ordenação da tela (chips do painel de Atalhos); o cleanup só remove se ainda for a atual. */
  registerSort(definition: ScreenSortDefinition): () => void {
    this.sortSignal.set(definition);

    return (): void => {
      if (this.sortSignal() === definition) {
        this.sortSignal.set(null);
      }
    };
  }

  /** Registra as ações da tela e devolve a função que as remove (só se ainda forem as atuais). */
  register(actions: readonly ScreenAction[]): () => void {
    this.actionsSignal.set(actions);

    return (): void => {
      if (this.actionsSignal() === actions) {
        this.actionsSignal.set([]);
      }
    };
  }
}
