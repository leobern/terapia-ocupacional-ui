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
  /** Título do painel enquanto o formulário está aberto (ex.: "Criar notificação"). */
  readonly title: string;
  readonly submitLabel: string;
  readonly fields: readonly FormFieldDefinition[];
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
export interface ConversationDefinition {
  readonly title: string;
  readonly steps: readonly ConversationStep[];
  readonly skipLabel: string;
  readonly successMessage: string;
  readonly errorMessage: string;
  readonly submit: (values: Readonly<Record<string, string>>) => Promise<void>;
}

export interface ScreenAction {
  readonly id: string;
  readonly label: string;
  /** Cadastro conversacional: o painel vira um chat que pergunta um dado por vez. */
  readonly conversation?: ConversationDefinition;
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

  /** Quando a tela registra um handler, mensagens do assistente são encaminhadas a ele, sem interpretação local. */
  readonly commandHandler: Signal<ScreenCommandHandler | null>;

  private readonly commandSignal = signal<ScreenCommandHandler | null>(null);
  private readonly actionsSignal = signal<readonly ScreenAction[]>([]);
  private readonly sortSignal = signal<ScreenSortDefinition | null>(null);

  constructor() {
    this.actions = this.actionsSignal.asReadonly();
    this.sort = this.sortSignal.asReadonly();
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
