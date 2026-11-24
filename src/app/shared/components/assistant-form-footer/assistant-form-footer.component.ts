import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AssistantFormController } from '../../services/assistant-form-controller.service';
import { InputChatComponent, type InputChatMode } from '../input-chat/input-chat.component';
import { TipComponent } from '../tip/tip.component';

/**
 * Rodapé do painel quando um cadastro está aberto (Figma 4722:10983): chips de sugestão da IA (só aparecem quando a
 * ação traz sugestões — V1 sem IA não tem) e o campo de mensagem/áudio, para o usuário descrever o cadastro em
 * linguagem natural e a IA preencher os campos. O envio do cadastro é o botão do próprio formulário.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputChatComponent, TipComponent],
  selector: 'app-assistant-form-footer',
  styleUrl: './assistant-form-footer.component.scss',
  templateUrl: './assistant-form-footer.component.html',
})
export class AssistantFormFooterComponent {
  protected readonly controller = inject(AssistantFormController);
  protected readonly value = signal('');
  protected readonly mode = signal<InputChatMode>('text');

  protected readonly suggestions = computed(() => this.controller.active()?.definition().suggestions ?? []);
  protected readonly placeholder = computed(
    () => this.controller.active()?.definition().messagePlaceholder ?? 'Fale ou escreva as informações do cadastro',
  );

  protected async onSend(text: string): Promise<void> {
    if (await this.controller.assist({ text })) {
      this.value.set('');
      this.mode.set('text');
    }
  }

  protected async onAudio(audio: Blob): Promise<void> {
    if (await this.controller.assist({ audio })) {
      this.value.set('');
    }
    this.mode.set('text');
  }
}
