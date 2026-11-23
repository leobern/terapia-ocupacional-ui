import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { AiAssistantService } from '../../services/ai-assistant.service';
import { type AssistantAnswerItem } from '../../services/assistant-query-resolver';
import { ScreenActionsService } from '../../services/screen-actions.service';
import { AssistantFormComponent } from '../assistant-form/assistant-form.component';
import { ButtonComponent } from '../button/button.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { IconLogoComponent } from '../icon-logo/icon-logo.component';
import { TipComponent } from '../tip/tip.component';

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

  private readonly router = inject(Router);

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
