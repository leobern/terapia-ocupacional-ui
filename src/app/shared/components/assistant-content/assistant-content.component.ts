import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { AiAssistantService } from '../../services/ai-assistant.service';
import { type AssistantAnswerItem } from '../../services/assistant-query-resolver';
import { ScreenActionsService, type ScreenContext } from '../../services/screen-actions.service';
import { AssistantFormComponent } from '../assistant-form/assistant-form.component';
import { ButtonComponent } from '../button/button.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { IconLogoComponent } from '../icon-logo/icon-logo.component';
import { TipComponent } from '../tip/tip.component';
import { TypewriterComponent } from '../typewriter/typewriter.component';

/** Saudação quando a tela não registrou um texto próprio (`ScreenActionsService.registerContext`). */
const DEFAULT_INTRO: ScreenContext = {
  description:
    'Quer tirar uma dúvida, ou quer que eu faça um resumo de todas as suas tarefas do dia? Eu posso fazer praticamente tudo, só me diz o que você precisa?',
  title: 'Como eu posso te ajudar?',
};

/** Depois que o texto termina de ser escrito, o aviso de texto/áudio aparece com fade após este tempo. */
export const HINT_DELAY_MS = 2000;

/** Atalhos de pergunta exibidos ao abrir o assistente (lista simples e substituível). */
/**
 * Corpo do assistente de IA (compartilhado pelo `app-bottom-sheet` e pelo `app-drawer`,
 * que o projetam): escolhe o que mostrar conforme `AiAssistantService.view()` — saudação
 * (`chat`), "Atalhos" da tela (`shortcuts`; os botões das ações ficam na faixa de atalhos
 * da superfície), formulário em cards (`form`) ou aviso de ação indisponível. Padrão de
 * cadastro: docs/regras-de-negocio/padrao-de-cadastro.md. Figma: 4506:10097 (atalhos) e
 * 4506:10525 (formulário).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AssistantFormComponent,
    NgTemplateOutlet,
    ButtonComponent,
    IconButtonComponent,
    TipComponent,
    TypewriterComponent,
    IconLogoComponent,
    PhIconComponent,
  ],
  selector: 'app-assistant-content',
  styleUrl: './assistant-content.component.scss',
  templateUrl: './assistant-content.component.html',
})
export class AssistantContentComponent {
  protected readonly assistant = inject(AiAssistantService);
  protected readonly screenActions = inject(ScreenActionsService);

  /** Título e descrição da tela atual (ou a saudação genérica). */
  protected readonly intro = computed(() => this.screenActions.context() ?? DEFAULT_INTRO);
  /** Só escreve com o painel aberto na visão de conversa. */
  protected readonly typing = computed(() => this.assistant.isOpen() && this.assistant.view() === 'chat');
  /** Muda a cada abertura (ou troca de tela): reinicia a digitação. */
  protected readonly typingKey = computed(() =>
    this.typing() ? { opening: this.assistant.openCount(), intro: this.intro() } : null,
  );
  protected readonly titleDone = computed(
    () => this.titleDoneKey() !== null && this.titleDoneKey() === this.typingKey(),
  );
  protected readonly descriptionDone = computed(
    () => this.descriptionDoneKey() !== null && this.descriptionDoneKey() === this.typingKey(),
  );
  protected readonly hintVisible = computed(() => this.hintKey() !== null && this.hintKey() === this.typingKey());

  private readonly router = inject(Router);
  private readonly titleDoneKey = signal<object | null>(null);
  private readonly descriptionDoneKey = signal<object | null>(null);
  private readonly hintKey = signal<object | null>(null);

  constructor() {
    // O aviso de texto/áudio aparece com fade, um tempinho depois do último caractere.
    effect(onCleanup => {
      const key = this.typingKey();

      if (key === null || !this.descriptionDone()) {
        return;
      }
      const timer = setTimeout(() => this.hintKey.set(key), HINT_DELAY_MS);

      onCleanup(() => clearTimeout(timer));
    });
  }

  protected onTitleFinished(): void {
    this.titleDoneKey.set(this.typingKey());
  }

  protected onDescriptionFinished(): void {
    this.descriptionDoneKey.set(this.typingKey());
  }

  protected itemText(item: AssistantAnswerItem): string {
    return typeof item === 'string' ? item : item.text;
  }

  protected itemTitle(item: AssistantAnswerItem): string | null {
    return typeof item === 'string' ? null : (item.title ?? null);
  }

  protected itemRoute(item: AssistantAnswerItem): string | null {
    return typeof item === 'string' ? null : item.route;
  }

  /** Seta do item / "Ver todas": fecha o painel e navega para o destino. */
  protected openRoute(route: string): void {
    this.assistant.closePanel();
    void this.router.navigateByUrl(route);
  }

  /** Erro na resposta: repete a mesma pergunta (Figma v2/ChatMessage Type=error). */
  protected retry(question: string): void {
    this.assistant.retry(question);
  }

  /** Cadastro concluído: volta para as ações da tela. */
  protected onSubmitted(): void {
    this.assistant.back();
  }
}
