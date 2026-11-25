import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AssistantEditorController } from '../../services/assistant-editor-controller.service';
import { InputChatComponent, type InputChatMode } from '../input-chat/input-chat.component';
import { TipComponent } from '../tip/tip.component';

/**
 * Rodapé do painel quando um editor está aberto (Figma 4775:26535): as ações do editor como chips ("Adicionar novo
 * item", "Salvar") logo acima do campo de mensagem/áudio.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputChatComponent, TipComponent],
  selector: 'app-assistant-editor-footer',
  styleUrl: './assistant-editor-footer.component.scss',
  templateUrl: './assistant-editor-footer.component.html',
})
export class AssistantEditorFooterComponent {
  protected readonly controller = inject(AssistantEditorController);
  protected readonly value = signal('');
  protected readonly mode = signal<InputChatMode>('text');

  protected readonly actions = computed(() => this.controller.active()?.actions() ?? []);
  protected readonly placeholder = computed(() => this.controller.active()?.placeholder ?? 'Escreva a sua mensagem');

  protected onSend(): void {
    this.controller.message();
    this.mode.set('text');
  }
}
