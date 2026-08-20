import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import { AutoResizeTextareaDirective } from '../../directives/auto-resize-textarea.directive';
import {
  type AudioCaptureErrorReason,
  AudioCaptureFailure,
  type AudioCaptureHandle,
  AudioCaptureService,
} from '../../services/audio-capture.service';
import { KeyboardFocusService } from '../../services/keyboard-focus.service';
import {
  type IconButtonAppearance,
  IconButtonComponent,
  type IconButtonKind,
} from '../icon-button/icon-button.component';
import { InputChatWaveformComponent } from './waveform/input-chat-waveform.component';

/** Modo ativo do campo. Não há sub-estados: o componente é indiferente à rede. */
export type InputChatMode = 'text' | 'audio';

export type { AudioCaptureErrorReason as InputChatAudioError };

interface MainButtonFace {
  appearance: IconButtonAppearance;
  ariaLabel: string;
  icon: string;
  kind: IconButtonKind;
}

/**
 * Campo de mensagem da assistente de IA (DS-component-input-chat).
 *
 * Dois modos:
 *  - `text`  — `<textarea>` que cresce até `maxHeight` e então rola;
 *  - `audio` — grava a fala com as ondas reagindo à amplitude captada.
 *
 * O modo áudio é **gravar-e-enviar**, não conversa contínua: o componente
 * captura, grava e emite o `Blob`; quem transcreve e conduz a conversa é o
 * consumidor. A conversa de voz contínua ficou para uma evolução futura, por
 * decisão registrada em spec.md § Clarifications.
 *
 * O componente é **indiferente à conectividade** (FR-018): não consulta
 * `navigator.onLine` nem escuta eventos de rede. Ele também não persiste nada
 * (FR-021) — persistência e fila de reenvio são da aplicação consumidora, sob
 * ADR próprio (Constituição, Princípios IV e V).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AutoResizeTextareaDirective, IconButtonComponent, InputChatWaveformComponent],
  selector: 'app-input-chat',
  styleUrl: './input-chat.component.scss',
  templateUrl: './input-chat.component.html',
})
export class InputChatComponent {
  readonly value = model<string>('');
  readonly mode = model<InputChatMode>('text');
  // Obrigatório, mesmo padrão de `input-select`: sem placeholder configurado, o
  // campo vazio fica sem nenhuma mensagem de instrução — falha de configuração
  // silenciosa que só aparece em teste manual. Falha em tempo de compilação.
  readonly placeholder = input.required<string>();
  // Teto de crescimento antes da rolagem. Default 160 vem do Figma
  // (`max-h-[160px]`, nó 4426:8736); exposto como prop porque um input-chat em
  // sidebar desktop pode querer outro teto.
  readonly maxHeight = input<number>(160);
  readonly disabled = input<boolean>(false);

  /**
   * Nome acessível do `<textarea>` (Princípio X). Opcional porque cai no
   * `placeholder`, que já é obrigatório — nenhuma instância fica anônima.
   *
   * Mesmo motivo do `input-select`: o placeholder visual some ao focar
   * (`displayPlaceholder`), então sem isto o campo ficaria sem nome acessível
   * justamente enquanto o usuário digita.
   */
  readonly ariaLabel = input<string>('');

  readonly send = output<string>();
  readonly audioModeStart = output();
  readonly audioModeStop = output();
  readonly audioSend = output<Blob>();
  readonly audioModeError = output<AudioCaptureErrorReason>();

  protected readonly focused = signal(false);
  /** Handle da captura ativa; `null` enquanto a permissão não resolveu. */
  protected readonly captureHandle = signal<AudioCaptureHandle | null>(null);

  // `trim()`: um valor só com espaços/quebras de linha conta como vazio para
  // decidir a face do botão principal (FR-009) — mas NÃO é normalizado no
  // campo, o usuário continua vendo o que digitou.
  protected readonly hasValue = computed(() => this.value().trim().length > 0);

  // Mesmo comportamento do input-select: o placeholder some ao focar (mesmo
  // antes de digitar) e volta só ao perder o foco com o campo vazio.
  protected readonly displayPlaceholder = computed(() => (this.focused() ? '' : this.placeholder()));

  // Nunca vazio: `placeholder` é obrigatório, então há sempre um nome acessível.
  protected readonly effectiveAriaLabel = computed(() => this.ariaLabel() || this.placeholder());

  /**
   * As três faces do MESMO botão — nunca três instâncias em `@if`. Um único nó
   * DOM garante que a posição não mude entre as faces (SC-004) e que o foco de
   * teclado não se perca no meio de uma transição.
   */
  protected readonly mainButtonFace = computed<MainButtonFace>(() => {
    if (this.mode() === 'audio') {
      return { appearance: 'solid', ariaLabel: 'Enviar áudio', icon: 'paper-plane-tilt', kind: 'primary' };
    }

    if (this.hasValue()) {
      return { appearance: 'solid', ariaLabel: 'Enviar mensagem', icon: 'paper-plane-tilt', kind: 'primary' };
    }

    return { appearance: 'icon', ariaLabel: 'Gravar áudio', icon: 'waveform', kind: 'secondary' };
  });

  // Anel rosa só quando o foco chega via teclado — ver KeyboardFocusService.
  protected readonly keyboardFocused = signal(false);

  private readonly keyboardFocusService = inject(KeyboardFocusService);
  private readonly audioCapture = inject(AudioCaptureService);

  constructor() {
    // Sair da página com o microfone aberto deixaria o indicador de gravação do
    // navegador aceso indefinidamente (FR-011).
    inject(DestroyRef).onDestroy(() => this.releaseCapture());
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLTextAreaElement).value);
  }

  protected onFocus(): void {
    this.focused.set(true);
    this.keyboardFocused.set(this.keyboardFocusService.isKeyboard());
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.keyboardFocused.set(false);
  }

  /** Enter envia, Shift+Enter quebra linha — convenção de chat (FR-009). */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.submitText();
  }

  protected onMainButtonClick(): void {
    if (this.disabled()) {
      return;
    }

    if (this.mode() === 'audio') {
      void this.submitAudio();

      return;
    }

    if (this.hasValue()) {
      this.submitText();

      return;
    }

    void this.startAudio();
  }

  /** Cancelar: descarta a gravação. Nunca envia (FR-020). */
  protected onCancelAudio(): void {
    this.releaseCapture();
    this.mode.set('text');
    this.audioModeStop.emit();
  }

  private submitText(): void {
    if (!this.hasValue() || this.disabled()) {
      return;
    }

    this.send.emit(this.value());
    this.value.set('');
  }

  private async startAudio(): Promise<void> {
    // Entra no modo áudio ANTES de a permissão resolver: assim as ondas já
    // aparecem no fallback canônico em vez de um campo vazio piscando (FR-005).
    this.mode.set('audio');

    try {
      this.captureHandle.set(await this.audioCapture.start());
      this.audioModeStart.emit();
    } catch (error) {
      const reason: AudioCaptureErrorReason = error instanceof AudioCaptureFailure ? error.reason : 'unavailable';

      // Permanece em `mode="audio"` com o fallback animado — quem decide sair é
      // o consumidor ou o usuário (FR-012).
      this.audioModeError.emit(reason);
    }
  }

  private async submitAudio(): Promise<void> {
    const handle = this.captureHandle();

    // Inerte enquanto a gravação não começou de fato — evita emitir um Blob
    // vazio se o usuário clicar em enviar antes de conceder a permissão.
    if (!handle) {
      return;
    }

    this.captureHandle.set(null);

    // `try/finally`: se `stopAndCollect()` rejeitar, o handle já saiu do signal e
    // ninguém mais chamaria `dispose()` — o microfone ficaria aberto com o
    // indicador de gravação do navegador aceso (FR-011), e o componente travado em
    // `mode="audio"` sem caminho de saída além do cancelar. O `finally` garante os
    // dois: libera a captura e volta ao modo texto em qualquer desfecho.
    try {
      const blob = await handle.stopAndCollect();

      this.audioSend.emit(blob);
    } catch {
      handle.dispose();
      this.audioModeError.emit('unavailable');
    } finally {
      this.mode.set('text');
      this.value.set('');
    }
  }

  private releaseCapture(): void {
    this.captureHandle()?.dispose();
    this.captureHandle.set(null);
  }
}
