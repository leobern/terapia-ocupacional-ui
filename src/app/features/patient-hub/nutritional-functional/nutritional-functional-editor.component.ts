import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';

import { FieldCardComponent } from '../../../shared/components/field-card/field-card.component';
import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import {
  AssistantEditorController,
  type EditorAction,
} from '../../../shared/services/assistant-editor-controller.service';
import {
  AssessmentFieldDefinition,
  AssessmentFieldId,
  AssessmentValues,
  ENERGY_SOURCE_CALORIMETRY,
  ENERGY_SOURCE_KCAL_PER_KG,
  KCAL_PER_KG,
  LIMB_SIDES,
  NutritionFunctionalAssessment,
} from '../assessment/assessment.models';
import { AssessmentSource } from '../assessment/assessment-source';
import { AssessmentWriter } from '../assessment/assessment-writer';
import { ClinicalAssessmentSource } from '../clinical-assessment/clinical-assessment-source';
import { NUTRITIONAL_FUNCTIONAL_FIELDS } from './nutritional-functional.models';

export const NUTRITIONAL_LOAD_FAILED_HINT = 'Não foi possível carregar a avaliação anterior. Os campos abrem vazios.';
export const NUTRITIONAL_SAVE_FAILED_HINT =
  'Não foi possível salvar a avaliação. Os valores digitados foram mantidos; tente novamente.';

/** Formata ISO como dd/MM (ano omitido, como no Figma 4682-9078). */
function shortDate(iso: string): string {
  const d = new Date(iso);

  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Gasto energético simplificado (kcal/kg × peso); vazio se o peso não for um número positivo. */
function kcalPerKg(weightKg: number | null): number | null {
  return weightKg !== null && weightKg > 0 ? Math.round(weightKg * KCAL_PER_KG) : null;
}

/**
 * Editor da "Avaliação nutricional e funcional", aberto no painel lateral pelo lápis do título (mesmo padrão da
 * Avaliação clínica). Itens fixos: circunferência da panturrilha e braquial (com o membro), calorimetria indireta,
 * handgrip e risco de disfagia; peso e altura ficam na Avaliação clínica. Nenhum campo é obrigatório: salva o que houver.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldCardComponent],
  selector: 'app-nutritional-functional-editor',
  styleUrl: './nutritional-functional-editor.component.scss',
  templateUrl: './nutritional-functional-editor.component.html',
})
export class NutritionalFunctionalEditorComponent {
  readonly patientId = input.required<string>();
  /** Chamado depois de salvar: a tela lê a avaliação de novo e, havendo triagem positiva, abre o Diagnóstico. */
  readonly saved = input<() => void>(() => undefined);

  protected readonly state = signal<'error' | 'loading' | 'ready'>('loading');
  protected readonly fields = NUTRITIONAL_FUNCTIONAL_FIELDS;
  protected readonly limbSides = LIMB_SIDES;
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);
  protected readonly loadFailedHint = NUTRITIONAL_LOAD_FAILED_HINT;
  protected readonly saveFailedHint = NUTRITIONAL_SAVE_FAILED_HINT;

  private readonly assessment = signal<NutritionFunctionalAssessment | null>(null);
  /** Valores em edição (começam da avaliação carregada); campo ausente = vazio. */
  private readonly draft = signal<Partial<Record<AssessmentFieldId, string>>>({});
  private weightKg: number | null = null;
  private readonly source = inject(AssessmentSource);
  private readonly writer = inject(AssessmentWriter);
  private readonly clinical = inject(ClinicalAssessmentSource);
  private readonly assistant = inject(AiAssistantService);
  private readonly editor = inject(AssistantEditorController);
  private token = 0;

  constructor() {
    effect(() => {
      const id = this.patientId();

      untracked(() => void this.load(id));
    });
    effect(onCleanup => {
      const actions = signal<readonly EditorAction[]>([{ id: 'save', label: 'Salvar' }]);

      onCleanup(
        this.editor.attach({
          actions,
          placeholder: 'Escreva a sua mensagem',
          run: (): void => {
            void this.save();
          },
        }),
      );
    });
  }

  protected valueOf(id: AssessmentFieldId): string {
    return this.draft()[id] ?? '';
  }

  protected edit(id: AssessmentFieldId, value: string): void {
    this.draft.update(current => ({ ...current, [id]: value }));
  }

  /** Título do card sem a unidade (ela vai dentro do campo): "Handgrip (kgf)" → "Handgrip". */
  protected titleOf(field: AssessmentFieldDefinition): string {
    return field.label.split(' (')[0];
  }

  /** Valor digitado sem membro: aviso em texto (não bloqueia o salvamento). */
  protected missingSide(field: AssessmentFieldDefinition): boolean {
    return field.sideId !== undefined && this.valueOf(field.id).trim() !== '' && this.valueOf(field.sideId) === '';
  }

  protected helpOf(field: AssessmentFieldDefinition): string {
    if (field.id === 'indirectCalorimetry' && this.valueOf(field.id).trim() === '') {
      const calculated = kcalPerKg(this.weightKg);

      if (calculated !== null) {
        return `Calculado (kcal/kg): ${calculated} kcal/dia (${KCAL_PER_KG} kcal/kg × peso).`;
      }
    }
    const previous = this.assessment()?.previous[field.id];

    if (previous === undefined) {
      return field.help;
    }
    const unit = field.unit === undefined ? '' : ` ${field.unit}`;

    return `Anterior: ${previous.value}${unit} em ${shortDate(previous.at)}.`;
  }

  /** Nenhum campo é obrigatório: salva o que houver, omitindo os vazios. */
  protected async save(): Promise<void> {
    if (this.saving() || this.state() !== 'ready') {
      return;
    }
    const values: Partial<Record<AssessmentFieldId, string>> = {};

    for (const [id, value] of Object.entries(this.draft())) {
      if (value.trim() !== '' && id !== 'energyExpenditure' && id !== 'energySource') {
        values[id as AssessmentFieldId] = value;
      }
    }
    // A calorimetria informada prevalece; senão vale o kcal/kg (só com peso, que vem da Avaliação clínica).
    const calculated = kcalPerKg(this.weightKg);

    if (values.indirectCalorimetry !== undefined) {
      values.energyExpenditure = values.indirectCalorimetry;
      values.energySource = ENERGY_SOURCE_CALORIMETRY;
    } else if (calculated !== null) {
      values.energyExpenditure = String(calculated);
      values.energySource = ENERGY_SOURCE_KCAL_PER_KG;
    }
    // Membro sem valor é ignorado ao salvar.
    const orphanSides = new Set(
      this.fields.filter(f => f.sideId !== undefined && values[f.id] === undefined).map(f => f.sideId),
    );
    const toSave = Object.fromEntries(
      Object.entries(values).filter(([id]) => !orphanSides.has(id as AssessmentFieldId)),
    );

    this.saving.set(true);
    this.saveFailed.set(false);
    try {
      await this.writer.save(this.patientId(), toSave as AssessmentValues);
      this.saved()();
      this.assistant.closePanel();
    } catch {
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;

    this.state.set('loading');
    this.clinical
      .load(patientId)
      .then(a => {
        this.weightKg = a.weightKg;
      })
      .catch(() => undefined);
    try {
      const latest = await this.source.loadLatest(patientId);

      if (token === this.token) {
        this.assessment.set(latest);
        this.draft.set({ ...latest?.values });
        this.state.set('ready');
      }
    } catch {
      if (token === this.token) {
        this.state.set('error');
      }
    }
  }
}
