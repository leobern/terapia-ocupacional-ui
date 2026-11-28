import { computed, DestroyRef, inject, Injectable, type Signal, signal } from '@angular/core';

import {
  type ConversationDefinition,
  type ConversationOption,
  type ConversationOutcome,
  type ConversationStep,
  ConversationStepError,
  type ConversationSummaryItem,
} from './screen-actions.service';

export interface ConversationMessage {
  readonly role: 'assistant' | 'user';
  readonly text: string;
  readonly tone?: 'error' | 'success';
  /** Cartão de resumo (dados coletados) mostrado sob o texto da IA. */
  readonly summary?: readonly ConversationSummaryItem[];
  readonly summaryTitle?: string;
}

/**
 * Cadastro por conversa no painel do assistente: pergunta um dado por vez, valida cada resposta e, se
 * inválida, mostra a mensagem do sistema e repete a mesma pergunta sem avançar. Ao coletar tudo,
 * chama `definition.submit`. A interpretação de linguagem natural é fora de escopo: a resposta é literal.
 */
@Injectable({ providedIn: 'root' })
export class AssistantConversationService {
  readonly messages: Signal<readonly ConversationMessage[]>;
  /** Etapa aguardando resposta; `null` antes de iniciar, durante o envio e após concluir. */
  readonly currentStep: Signal<ConversationStep | null>;
  readonly submitting: Signal<boolean>;
  readonly finished: Signal<boolean>;
  readonly options: Signal<readonly ConversationOption[]>;
  readonly canSkip: Signal<boolean>;
  readonly skipLabel: Signal<string>;
  /** Atalho para pular direto à etapa final (ex.: "Salvar paciente"), quando a etapa atual oferece. */
  readonly jump: Signal<{ readonly label: string } | null>;
  /** Envio falhou sem etapa associada: o profissional pode tentar de novo sem perder as respostas. */
  readonly canRetry: Signal<boolean>;
  /** A IA "está pensando": a próxima mensagem dela ainda não apareceu (indicador no chat). */
  readonly thinking: Signal<boolean>;
  /** Pausa antes de cada mensagem da IA, em ms (padrão de ferramentas de IA); 0 = aparece na hora (testes). */
  thinkingMs = 0;

  private readonly messagesSignal = signal<readonly ConversationMessage[]>([]);
  private readonly stepIndex = signal<number | null>(null);
  private readonly submittingSignal = signal(false);
  private readonly finishedSignal = signal(false);
  private readonly retrySignal = signal(false);
  private readonly thinkingSignal = signal(false);
  private pending: ConversationMessage[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private definition: ConversationDefinition | null = null;
  private values: Record<string, string> = {};
  private generation = 0;

  constructor() {
    this.messages = this.messagesSignal.asReadonly();
    this.submitting = this.submittingSignal.asReadonly();
    this.finished = this.finishedSignal.asReadonly();
    this.canRetry = this.retrySignal.asReadonly();
    this.thinking = this.thinkingSignal.asReadonly();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    this.currentStep = computed(() => {
      const index = this.stepIndex();

      return index === null ? null : (this.definition?.steps[index] ?? null);
    });
    // Enquanto a IA pensa, a etapa seguinte ainda não foi "dita": sem opções nem "Pular".
    this.options = computed(() => (this.thinkingSignal() ? [] : (this.currentStep()?.options ?? [])));
    this.canSkip = computed(() => !this.thinkingSignal() && this.currentStep()?.optional === true);
    this.skipLabel = computed(() => this.definition?.skipLabel ?? '');
    this.jump = computed(() => (this.thinkingSignal() ? null : (this.currentStep()?.jumpTo ?? null)));
  }

  start(definition: ConversationDefinition): void {
    this.reset();
    this.definition = definition;
    this.stepIndex.set(0);
    this.messagesSignal.set([{ role: 'assistant', text: definition.steps[0].prompt }]);
  }

  reset(): void {
    this.generation++;
    clearTimeout(this.timer);
    this.pending = [];
    this.thinkingSignal.set(false);
    this.definition = null;
    this.values = {};
    this.stepIndex.set(null);
    this.messagesSignal.set([]);
    this.submittingSignal.set(false);
    this.finishedSignal.set(false);
    this.retrySignal.set(false);
  }

  /** Resposta do profissional à etapa atual (texto digitado ou opção escolhida). */
  answer(raw: string, display = raw): void {
    const step = this.currentStep();

    if (!step || this.submittingSignal()) {
      return;
    }
    const text = raw.trim();

    this.push({ role: 'user', text: display.trim() || '—' });
    if (text === '' && step.optional) {
      this.accept(step, '');

      return;
    }
    const result = step.parse(text, this.values);

    if ('error' in result) {
      this.push({ role: 'assistant', text: result.error, tone: 'error' });
      this.push({ role: 'assistant', text: step.prompt });

      return;
    }
    const target = step.rewind?.(result.value, this.values) ?? null;

    if (target) {
      this.rewindTo(target);

      return;
    }
    this.accept(step, result.value);
  }

  /** Opção selecionável (ex.: sexo): responde com o texto do rótulo, validado como qualquer resposta. */
  choose(option: ConversationOption): void {
    this.answer(option.label);
  }

  /**
   * Atalho "Salvar paciente" nas perguntas extras: as etapas opcionais que faltam ficam em branco e a conversa volta à
   * confirmação, com o resumo atualizado.
   */
  jumpToTarget(): void {
    const target = this.currentStep()?.jumpTo;
    const definition = this.definition;

    if (!target || !definition || this.submittingSignal() || this.thinkingSignal()) {
      return;
    }
    const index = definition.steps.findIndex(s => s.id === target.stepId);

    if (index < 0) {
      return;
    }
    const values = { ...this.values };

    definition.steps.forEach((step, position) => {
      if (position < index && step.optional && !(step.id in values) && (step.when?.(values) ?? true)) {
        values[step.id] = '';
      }
    });
    this.values = Object.fromEntries(Object.entries(values).filter(([id]) => id !== target.stepId));
    this.push({ role: 'user', text: target.label });
    this.stepIndex.set(index);
    this.push(this.promptOf(definition.steps[index]));
  }

  /** "Pular" numa etapa opcional. */
  skip(): void {
    if (this.canSkip() && this.definition) {
      this.answer('', this.definition.skipLabel);
    }
  }

  /** Tenta enviar de novo após uma falha, mantendo as respostas. */
  retry(): void {
    if (this.retrySignal() && !this.submittingSignal()) {
      this.retrySignal.set(false);
      void this.send();
    }
  }

  /** Mensagem da IA que faz a pergunta de `step`, com o cartão de resumo quando a etapa tem um. */
  private promptOf(step: ConversationStep): ConversationMessage {
    const items = step.summary?.(this.values);

    return items && items.length > 0
      ? { role: 'assistant', summary: items, summaryTitle: step.summaryTitle, text: step.prompt }
      : { role: 'assistant', text: step.prompt };
  }

  /** Volta a uma etapa anterior (ex.: "Informar mais dados"): descarta as respostas dela em diante e a pergunta de novo. */
  private rewindTo(target: { readonly stepId: string; readonly set?: Readonly<Record<string, string>> }): void {
    const definition = this.definition as ConversationDefinition;
    const index = definition.steps.findIndex(s => s.id === target.stepId);

    if (index < 0) {
      return;
    }
    const kept: Record<string, string> = {};

    for (const earlier of definition.steps.slice(0, index)) {
      if (earlier.id in this.values) {
        kept[earlier.id] = this.values[earlier.id];
      }
    }
    this.values = { ...kept, ...target.set };
    this.stepIndex.set(index);
    this.push(this.promptOf(definition.steps[index]));
  }

  private accept(step: ConversationStep, value: string): void {
    const definition = this.definition as ConversationDefinition;

    this.values = { ...this.values, [step.id]: value };
    // Próxima etapa ainda sem resposta (após corrigir uma etapa devolvida pelo servidor, segue direto ao envio).
    const next = definition.steps.findIndex(s => !(s.id in this.values) && (s.when?.(this.values) ?? true));

    if (next >= 0) {
      this.stepIndex.set(next);
      this.push(this.promptOf(definition.steps[next]));

      return;
    }
    this.stepIndex.set(null);
    void this.send();
  }

  private async send(): Promise<void> {
    const definition = this.definition as ConversationDefinition;
    const generation = this.generation;

    this.submittingSignal.set(true);
    try {
      const outcome = (await definition.submit({ ...this.values })) as ConversationOutcome | undefined;

      if (generation !== this.generation) {
        return;
      }
      if (outcome?.confirmation) {
        this.askConfirmation(
          definition,
          outcome as ConversationOutcome & { confirmation: NonNullable<ConversationOutcome['confirmation']> },
        );

        return;
      }
      this.finishedSignal.set(true);
      this.push({
        role: 'assistant',
        text: outcome?.message ?? definition.successMessage,
        tone: outcome?.tone ?? 'success',
      });
    } catch (error) {
      if (generation !== this.generation) {
        return;
      }
      this.fail(definition, error);
    } finally {
      if (generation === this.generation) {
        this.submittingSignal.set(false);
      }
    }
  }

  /** Mostra o resumo e passa a aguardar a resposta da etapa de confirmação (a única que resta). */
  private askConfirmation(
    definition: ConversationDefinition,
    outcome: ConversationOutcome & { confirmation: NonNullable<ConversationOutcome['confirmation']> },
  ): void {
    const { step, submit } = outcome.confirmation;

    this.definition = {
      ...definition,
      steps: [step],
      submit: (values): Promise<ConversationOutcome> => submit(values[step.id]),
    };
    this.values = {};
    this.push({ role: 'assistant', text: outcome.message });
    this.push({ role: 'assistant', text: step.prompt });
    this.stepIndex.set(0);
  }

  private fail(definition: ConversationDefinition, error: unknown): void {
    const index = error instanceof ConversationStepError ? definition.steps.findIndex(s => s.id === error.stepId) : -1;

    if (error instanceof ConversationStepError && index >= 0) {
      this.stepIndex.set(index);
      this.push({ role: 'assistant', text: error.message, tone: 'error' });
      this.push({ role: 'assistant', text: definition.steps[index].prompt });

      return;
    }
    this.retrySignal.set(true);
    this.push({ role: 'assistant', text: definition.errorMessage, tone: 'error' });
  }

  /** Mensagem do profissional entra na hora; a da IA espera `thinkingMs` (com o indicador "pensando") e vem em fila. */
  private push(message: ConversationMessage): void {
    if (message.role === 'user' || this.thinkingMs <= 0) {
      this.messagesSignal.update(list => [...list, message]);

      return;
    }
    this.pending.push(message);
    if (!this.thinkingSignal()) {
      this.thinkingSignal.set(true);
      this.scheduleNext();
    }
  }

  private scheduleNext(): void {
    const generation = this.generation;

    this.timer = setTimeout(() => {
      if (generation !== this.generation) {
        return;
      }
      const next = this.pending.shift();

      if (next) {
        this.messagesSignal.update(list => [...list, next]);
      }
      if (this.pending.length > 0) {
        this.scheduleNext();
      } else {
        this.thinkingSignal.set(false);
      }
    }, this.thinkingMs);
  }
}
