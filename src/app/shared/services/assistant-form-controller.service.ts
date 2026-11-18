import { Injectable, type Signal, signal } from '@angular/core';

/** O que o rodapé do painel precisa saber do formulário aberto para exibir e acionar o envio. */
export interface ActiveAssistantForm {
  /** Rótulo do botão de envio (ex.: "Criar notificação"). */
  readonly label: Signal<string>;
  /** Todas as perguntas obrigatórias respondidas e nada sendo enviado. */
  readonly canSubmit: Signal<boolean>;
  readonly submit: () => Promise<void>;
}

/**
 * Ponte entre o formulário em cards (dentro do painel) e o botão de envio, que mora no RODAPÉ do
 * painel (no lugar do campo de mensagem) — dois pontos diferentes da árvore do assistente.
 * O formulário se registra ao nascer e se remove ao ser destruído.
 */
@Injectable({ providedIn: 'root' })
export class AssistantFormController {
  readonly active: Signal<ActiveAssistantForm | null>;

  private readonly activeSignal = signal<ActiveAssistantForm | null>(null);

  constructor() {
    this.active = this.activeSignal.asReadonly();
  }

  /** Registra o formulário aberto e devolve a função que o remove (só se ainda for o atual). */
  attach(form: ActiveAssistantForm): () => void {
    this.activeSignal.set(form);

    return (): void => {
      if (this.activeSignal() === form) {
        this.activeSignal.set(null);
      }
    };
  }
}
