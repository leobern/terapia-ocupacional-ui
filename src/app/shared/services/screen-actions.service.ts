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
  /** Persiste o cadastro. Lançar erro mantém o formulário aberto com os dados. */
  readonly submit: (values: FormValues) => Promise<void> | void;
}

export interface ScreenAction {
  readonly id: string;
  readonly label: string;
  /** Ausente = ação ainda não disponível (o painel avisa em vez de abrir um formulário). */
  readonly form?: FormActionDefinition;
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
 * Registro das ações da tela atual. A tela chama `register()` ao iniciar e o cleanup
 * devolvido ao destruir — o assistente só lê `actions()`.
 */
@Injectable({ providedIn: 'root' })
export class ScreenActionsService {
  readonly actions: Signal<readonly ScreenAction[]>;

  readonly sort: Signal<ScreenSortDefinition | null>;

  private readonly actionsSignal = signal<readonly ScreenAction[]>([]);
  private readonly sortSignal = signal<ScreenSortDefinition | null>(null);

  constructor() {
    this.actions = this.actionsSignal.asReadonly();
    this.sort = this.sortSignal.asReadonly();
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
