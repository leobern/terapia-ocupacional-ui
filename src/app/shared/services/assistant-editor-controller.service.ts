import { Injectable, type Signal, signal } from '@angular/core';

/** Ação do editor mostrada como chip acima do campo de mensagem (ex.: "Adicionar novo item", "Salvar"). */
export interface EditorAction {
  readonly id: string;
  readonly label: string;
}

/** O que o rodapé do painel precisa saber do editor aberto. */
export interface ActiveAssistantEditor {
  readonly actions: Signal<readonly EditorAction[]>;
  readonly run: (id: string) => void;
  readonly placeholder: string;
}

export const EDITOR_ASSIST_UNAVAILABLE_HINT =
  'A alteração por mensagem ou áudio ainda não está disponível. Use os campos acima.';

/**
 * Ponte entre o editor (dentro do painel) e o rodapé do painel (chips de ação + campo de mensagem/áudio): dois pontos
 * diferentes da árvore do assistente. O editor se registra ao nascer e se remove ao ser destruído.
 */
@Injectable({ providedIn: 'root' })
export class AssistantEditorController {
  readonly active: Signal<ActiveAssistantEditor | null>;
  readonly hint: Signal<string | null>;

  private readonly activeSignal = signal<ActiveAssistantEditor | null>(null);
  private readonly hintSignal = signal<string | null>(null);

  constructor() {
    this.active = this.activeSignal.asReadonly();
    this.hint = this.hintSignal.asReadonly();
  }

  /** Registra o editor aberto e devolve a função que o remove (só se ainda for o atual). */
  attach(editor: ActiveAssistantEditor): () => void {
    this.activeSignal.set(editor);
    this.hintSignal.set(null);

    return (): void => {
      if (this.activeSignal() === editor) {
        this.activeSignal.set(null);
        this.hintSignal.set(null);
      }
    };
  }

  run(id: string): void {
    this.hintSignal.set(null);
    this.activeSignal()?.run(id);
  }

  /** Mensagem ou áudio do rodapé: a IA ainda não altera os itens; avisa e deixa o preenchimento manual. */
  message(): void {
    this.hintSignal.set(EDITOR_ASSIST_UNAVAILABLE_HINT);
  }
}
