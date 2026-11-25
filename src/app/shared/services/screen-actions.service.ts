import { Injectable, type Signal, signal, type Type } from '@angular/core';

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

/** Erro de envio com mensagem própria para o usuário (ex.: sem conexão); o formulário a exibe e mantém as respostas. */
export class FormSubmitError extends Error {}

export interface FormFieldDefinition {
  readonly id: string;
  /** Pergunta exibida no cabeçalho do card. */
  readonly label: string;
  readonly kind: FormFieldKind;
  readonly placeholder: string;
  readonly required: boolean;
  /** Motivo exibido enquanto uma pergunta obrigatória está sem resposta (ex.: "Informe ao menos um destinatário"). */
  readonly requiredMessage?: string;
  /**
   * Só em `mention`: sugere destinatários a partir do texto do campo `from` (ao sair dele, se ainda
   * não há ninguém marcado). As sugestões ficam à parte e só valem após confirmação explícita.
   * Rejeitar = IA indisponível: o preenchimento manual segue funcionando.
   */
  readonly suggest?: { readonly from: string; readonly run: (content: string) => Promise<readonly DirectoryUser[]> };
}

export interface FormActionDefinition {
  /** Título do painel enquanto o formulário está aberto (ex.: "Criar notificação"); é digitado no topo do conteúdo. */
  readonly title: string;
  /** Texto digitado abaixo do título, antes de surgirem os campos; ausente = texto padrão do cadastro. */
  readonly description?: string;
  readonly submitLabel: string;
  readonly fields: readonly FormFieldDefinition[];
  /** Placeholder do campo de mensagem/áudio do rodapé (ex.: "Fale ou escreva a notificação"). */
  readonly messagePlaceholder?: string;
  /**
   * Sugestões inteligentes (chips acima do campo de mensagem), calculadas pela IA a partir do histórico. Ausente ou
   * vazio = a área não aparece (V1 sem IA).
   */
  readonly suggestions?: readonly string[];
  /** Respostas de texto já preenchidas (por id de campo), ex.: conteúdo ditado por áudio; continuam editáveis. */
  readonly initialValues?: Readonly<Record<string, string>>;
  /** Aviso discreto exibido no topo do formulário (ex.: falha na transcrição do áudio). */
  readonly notice?: string;
  /** Persiste o cadastro. Lançar erro mantém o formulário aberto com os dados. */
  readonly submit: (values: FormValues) => Promise<void> | void;
}

/** Resultado da validação da resposta de uma etapa da conversa: valor aceito ou a mensagem do sistema a exibir. */
export type ConversationParseResult = { readonly value: string } | { readonly error: string };

/** Opção selecionável de uma etapa de escolha (ex.: sexo): `value` é o valor do contrato, `label` o texto exibido. */
export interface ConversationOption {
  readonly value: string;
  readonly label: string;
}

/** Uma pergunta da conversa: o assistente pergunta, valida a resposta e só avança se ela for válida. */
export interface ConversationStep {
  readonly id: string;
  readonly prompt: string;
  /** Opções selecionáveis; a resposta digitada também é validada por `parse`. */
  readonly options?: readonly ConversationOption[];
  /** Etapa opcional: resposta vazia (ou "Pular") avança sem valor. */
  readonly optional?: boolean;
  /** Etapa condicional: só é perguntada quando devolve `true` para as respostas já dadas (ex.: internação só se "sim"). */
  readonly when?: (values: Readonly<Record<string, string>>) => boolean;
  /** `values` são as respostas já aceitas (para regras que dependem de etapas anteriores). */
  readonly parse: (answer: string, values: Readonly<Record<string, string>>) => ConversationParseResult;
}

/** Erro de envio ligado a uma etapa (ex.: 422 do servidor): a conversa volta para ela exibindo `message`. */
export class ConversationStepError extends Error {
  constructor(
    readonly stepId: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Cadastro conduzido por conversa, um dado por vez (ex.: paciente, FT-002-1). `submit` recebe os valores
 * validados por `id` de etapa; lançar `ConversationStepError` volta à etapa, qualquer outro erro mostra `errorMessage`.
 */
export interface ConversationOutcome {
  readonly message: string;
  readonly tone: 'error' | 'success';
}

export interface ConversationDefinition {
  readonly title: string;
  /** Texto digitado abaixo do título, antes da primeira pergunta; ausente = texto padrão. */
  readonly description?: string;
  readonly steps: readonly ConversationStep[];
  readonly skipLabel: string;
  readonly successMessage: string;
  readonly errorMessage: string;
  /** Resolver com `ConversationOutcome` substitui `successMessage` (ex.: resultado dinâmico ou bloqueio sem retentativa). */
  readonly submit: (values: Readonly<Record<string, string>>) => Promise<ConversationOutcome> | Promise<void>;
  /**
   * Pedido feito por mensagem livre (ex.: "mudar para o leito 412"): devolve a resposta da primeira etapa
   * extraída da própria mensagem (vazia se não achou), que é respondida automaticamente ao abrir a conversa.
   */
  readonly seedFromMessage?: (message: string) => string;
}

/**
 * Editor próprio no painel lateral (ex.: Avaliação clínica, Figma 4775:26535): título e descrição digitados e, depois,
 * o componente com os campos. As ações do editor ficam no rodapé (chips) e a mensagem/áudio, embaixo.
 */
export interface AssistantEditorDefinition {
  readonly title: string;
  readonly description: string;
  /** Linha pequena abaixo da descrição (ex.: "Você também pode enviar via áudio."). */
  readonly hint?: string;
  readonly component: Type<unknown>;
  readonly inputs?: Readonly<Record<string, unknown>>;
}

export interface ScreenAction {
  readonly id: string;
  readonly label: string;
  /** Cadastro conversacional: o painel vira um chat que pergunta um dado por vez. */
  readonly conversation?: ConversationDefinition;
  /** Ausente = ação ainda não disponível (o painel avisa em vez de abrir um formulário). */
  readonly form?: FormActionDefinition;
  /** Editor com componente próprio (itens dinâmicos, exclusão com confirmação...). */
  readonly editor?: AssistantEditorDefinition;
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
