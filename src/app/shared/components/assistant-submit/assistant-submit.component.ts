import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AssistantFormController } from '../../services/assistant-form-controller.service';
import { ButtonComponent } from '../button/button.component';

/**
 * Botão de envio do cadastro, no RODAPÉ do painel (no lugar do campo de mensagem e do áudio
 * enquanto um formulário está aberto). Aciona o formulário registrado em
 * `AssistantFormController`. Padrão de cadastro: docs/regras-de-negocio/padrao-de-cadastro.md.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  selector: 'app-assistant-submit',
  styleUrl: './assistant-submit.component.scss',
  templateUrl: './assistant-submit.component.html',
})
export class AssistantSubmitComponent {
  protected readonly controller = inject(AssistantFormController);
}
