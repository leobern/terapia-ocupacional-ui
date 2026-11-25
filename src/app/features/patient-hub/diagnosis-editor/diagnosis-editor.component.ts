import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { FieldCardComponent } from '../../../shared/components/field-card/field-card.component';
import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import {
  AssistantEditorController,
  type EditorAction,
} from '../../../shared/services/assistant-editor-controller.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { HypothesisOrigin } from '../patient-hub.models';
import { HypothesisSynthesizer, HypothesisWriter } from '../patient-hub-source';

/** Tamanho máximo do texto do prontuário (1K). */
export const DIAGNOSIS_MAX_LENGTH = 1000;
export const DIAGNOSIS_OFFLINE_HINT = 'Conexão necessária para sintetizar ou salvar o diagnóstico.';
export const DIAGNOSIS_EMPTY_HINT = 'Escreva o texto do prontuário antes de continuar.';
export const DIAGNOSIS_SYNTH_FAILED_HINT =
  'A síntese por IA falhou ou está indisponível. Escreva o diagnóstico manualmente e salve.';
export const DIAGNOSIS_SAVE_FAILED_HINT =
  'Não foi possível salvar o diagnóstico. O texto foi mantido; tente novamente.';

/**
 * Cadastro do Diagnóstico no painel lateral conversacional (Thiago, 2026-11-25): o texto do prontuário (até 1K) e,
 * abaixo, o médico responsável. "Sintetizar texto com IA" e "Salvar" ficam como atalhos acima do campo de mensagem e só
 * aparecem depois de haver texto. A IA ainda é provisória: se faltar, o médico escreve o diagnóstico à mão.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, FieldCardComponent],
  selector: 'app-diagnosis-editor',
  styleUrl: './diagnosis-editor.component.scss',
  templateUrl: './diagnosis-editor.component.html',
})
export class DiagnosisEditorComponent {
  readonly patientId = input.required<string>();
  /** Texto atual do diagnóstico (edição); vazio no primeiro cadastro. */
  readonly initialText = input('');
  readonly responsibleName = input('');
  readonly responsibleRole = input('');
  /** Chamado depois de salvar, com o texto gravado. */
  readonly saved = input<(text: string) => void>(() => undefined);

  protected readonly text = signal('');
  protected readonly busy = signal(false);
  protected readonly hint = signal<string | null>(null);
  protected readonly maxLength = DIAGNOSIS_MAX_LENGTH;
  protected readonly counter = computed(() => `${this.text().length}/${DIAGNOSIS_MAX_LENGTH}`);

  private readonly synthesizer = inject(HypothesisSynthesizer);
  private readonly writer = inject(HypothesisWriter);
  private readonly assistant = inject(AiAssistantService);
  private readonly editor = inject(AssistantEditorController);
  private readonly connectivity = inject(ConnectivityService);
  private readonly professional = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  /** Retorno original da IA: distingue "salvo sem editar" de "editado". */
  private aiText = '';
  private seeded = false;

  constructor() {
    effect(() => {
      const initial = this.initialText();

      if (!this.seeded) {
        this.seeded = true;
        this.text.set(initial);
      }
    });
    effect(onCleanup => {
      // Os atalhos só aparecem depois que há texto no prontuário.
      const actions = computed<readonly EditorAction[]>(() =>
        this.text().trim() === ''
          ? []
          : [
              { id: 'synthesize', label: 'Sintetizar texto com IA' },
              { id: 'save', label: 'Salvar' },
            ],
      );

      onCleanup(
        this.editor.attach({
          actions,
          placeholder: 'Escreva a sua mensagem',
          run: (action): void => {
            if (action === 'synthesize') {
              void this.synthesize();
            } else {
              void this.save();
            }
          },
        }),
      );
    });
  }

  protected edit(value: string): void {
    this.text.set(value);
    this.hint.set(null);
  }

  protected async synthesize(): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (!this.connectivity.online()) {
      this.hint.set(DIAGNOSIS_OFFLINE_HINT);

      return;
    }
    if (this.text().trim() === '') {
      this.hint.set(DIAGNOSIS_EMPTY_HINT);

      return;
    }
    this.busy.set(true);
    this.hint.set(null);
    try {
      this.aiText = (await this.synthesizer.synthesize(this.text())).trim();
      this.text.set(this.aiText);
    } catch {
      this.aiText = '';
      this.hint.set(DIAGNOSIS_SYNTH_FAILED_HINT);
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(): Promise<void> {
    const text = this.text().trim();

    if (this.busy()) {
      return;
    }
    if (!this.connectivity.online()) {
      this.hint.set(DIAGNOSIS_OFFLINE_HINT);

      return;
    }
    if (text === '') {
      this.hint.set(DIAGNOSIS_EMPTY_HINT);

      return;
    }
    this.busy.set(true);
    try {
      await this.writer.save({
        at: this.now().toISOString(),
        author: this.professional.read().name,
        origin: this.originOf(text),
        patientId: this.patientId(),
        text,
      });
      this.saved()(text);
      this.assistant.closePanel();
    } catch {
      this.hint.set(DIAGNOSIS_SAVE_FAILED_HINT);
    } finally {
      this.busy.set(false);
    }
  }

  private originOf(text: string): HypothesisOrigin {
    if (this.aiText === '') {
      return 'manual';
    }

    return text === this.aiText ? 'ai' : 'ai-edited';
  }
}
