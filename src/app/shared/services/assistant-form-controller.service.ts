import { inject, Injectable, type Signal, signal } from '@angular/core';

import { FormAssistant, type FormAssistInput } from './form-assistant';
import { type FormActionDefinition, type FormValues } from './screen-actions.service';

/** O que o rodapé do painel precisa saber do formulário aberto para acioná-lo. */
export interface ActiveAssistantForm {
  /** Definição do cadastro aberto (título, sugestões, placeholder da mensagem). */
  readonly definition: Signal<FormActionDefinition>;
  /** Aplica valores (vindos da IA) nos campos do formulário, para o usuário revisar. */
  readonly apply: (values: FormValues) => void;
}

export const ASSIST_UNAVAILABLE_HINT = 'O preenchimento por IA ainda não está disponível. Preencha os campos acima.';

/**
 * Ponte entre o formulário em cards (dentro do painel) e o rodapé do painel (sugestões + campo de mensagem/áudio):
 * dois pontos diferentes da árvore do assistente. O formulário se registra ao nascer e se remove ao ser destruído.
 */
@Injectable({ providedIn: 'root' })
export class AssistantFormController {
  readonly active: Signal<ActiveAssistantForm | null>;
  /** Aviso do último preenchimento por IA que não aconteceu (ou `null`). */
  readonly assistHint: Signal<string | null>;
  readonly assisting: Signal<boolean>;

  private readonly activeSignal = signal<ActiveAssistantForm | null>(null);
  private readonly hintSignal = signal<string | null>(null);
  private readonly assistingSignal = signal(false);
  private readonly assistant = inject(FormAssistant, { optional: true });

  constructor() {
    this.active = this.activeSignal.asReadonly();
    this.assistHint = this.hintSignal.asReadonly();
    this.assisting = this.assistingSignal.asReadonly();
  }

  /** Registra o formulário aberto e devolve a função que o remove (só se ainda for o atual). */
  attach(form: ActiveAssistantForm): () => void {
    this.activeSignal.set(form);
    this.hintSignal.set(null);

    return (): void => {
      if (this.activeSignal() === form) {
        this.activeSignal.set(null);
        this.hintSignal.set(null);
      }
    };
  }

  /** Texto ou áudio do rodapé → a IA preenche os campos. Devolve `true` se algum valor foi aplicado. */
  async assist(input: FormAssistInput): Promise<boolean> {
    const form = this.activeSignal();

    if (!form) {
      return false;
    }
    this.hintSignal.set(null);
    this.assistingSignal.set(true);
    try {
      const values = this.assistant ? await this.assistant.fill(form.definition(), input) : null;

      if (values === null) {
        this.hintSignal.set(ASSIST_UNAVAILABLE_HINT);

        return false;
      }
      form.apply(values);

      return true;
    } catch {
      this.hintSignal.set(ASSIST_UNAVAILABLE_HINT);

      return false;
    } finally {
      this.assistingSignal.set(false);
    }
  }
}
