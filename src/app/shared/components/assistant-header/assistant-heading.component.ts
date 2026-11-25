import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { AiAssistantService } from '../../services/ai-assistant.service';

/**
 * Título "Atalhos" no cabeçalho do painel, na posição do logo (a IA não conversa na visão de atalhos). Projetado no
 * cabeçalho do bottom sheet / drawer, que só o exibe quando o logo está escondido.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-assistant-heading',
  styleUrl: './assistant-heading.component.scss',
  templateUrl: './assistant-heading.component.html',
})
export class AssistantHeadingComponent {
  protected readonly assistant = inject(AiAssistantService);

  /** "Atalhos": no lugar do logo (a IA não conversa nessa visão). Os cadastros têm o logo da IA e o título digitado. */
  protected readonly title = computed(() => (this.assistant.view() === 'shortcuts' ? 'Atalhos' : ''));
}
