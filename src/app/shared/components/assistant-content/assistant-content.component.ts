import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AiAssistantService } from '../../services/ai-assistant.service';
import { ScreenActionsService } from '../../services/screen-actions.service';
import { AssistantFormComponent } from '../assistant-form/assistant-form.component';
import { ButtonComponent } from '../button/button.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';

/**
 * Corpo do assistente de IA (compartilhado pelo `app-bottom-sheet` e pelo `app-drawer`,
 * que o projetam): escolhe o que mostrar conforme `AiAssistantService.view()` — saudação
 * (`chat`), "Atalhos" da tela (`shortcuts`; os botões das ações ficam na faixa de atalhos
 * da superfície), formulário em cards (`form`) ou aviso de ação indisponível. Padrão de
 * cadastro: docs/regras-de-negocio/padrao-de-cadastro.md. Figma: 4506:10097 (atalhos) e
 * 4506:10525 (formulário).
 */
/** Atalhos de pergunta exibidos ao abrir o assistente (lista simples e substituível). */
export const ASSISTANT_SUGGESTIONS: readonly string[] = [
  'Quais são minhas pendências de hoje?',
  'Quantos pacientes tenho para atender hoje?',
  'Resuma as notificações não lidas',
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AssistantFormComponent, ButtonComponent, IconButtonComponent],
  selector: 'app-assistant-content',
  styleUrl: './assistant-content.component.scss',
  templateUrl: './assistant-content.component.html',
})
export class AssistantContentComponent {
  protected readonly assistant = inject(AiAssistantService);
  protected readonly suggestions = ASSISTANT_SUGGESTIONS;
  protected readonly screenActions = inject(ScreenActionsService);

  /** Cadastro concluído: volta para as ações da tela. */
  protected onSubmitted(): void {
    this.assistant.back();
  }
}
