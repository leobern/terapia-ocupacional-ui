import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { AiAssistantService } from '../../services/ai-assistant.service';
import { IconButtonComponent } from '../icon-button/icon-button.component';

/**
 * Cabeçalho do painel quando uma ação está aberta (formulário de cadastro ou aviso de ação
 * indisponível): seta de voltar + título, no lugar da logo (padrão de cadastro —
 * docs/regras-de-negocio/padrao-de-cadastro.md). Projetado no cabeçalho do bottom sheet / drawer.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent],
  selector: 'app-assistant-heading',
  styleUrl: './assistant-heading.component.scss',
  templateUrl: './assistant-heading.component.html',
})
export class AssistantHeadingComponent {
  protected readonly assistant = inject(AiAssistantService);

  protected readonly title = computed(() => {
    const action = this.assistant.activeAction();

    return action?.form?.title ?? action?.label ?? '';
  });
}
