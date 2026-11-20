import {
  ChangeDetectionStrategy,
  Component,
  effect,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { IconButtonComponent } from '../../../shared/components/icon-button/icon-button.component';
import { PhIconComponent } from '../../../shared/icons/ph-icon/ph-icon.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import {
  ASSESSMENT_SECTIONS,
  ENERGY_SOURCE_CALORIMETRY,
  ENERGY_SOURCE_KCAL_PER_KG,
  KCAL_PER_KG,
  AssessmentFieldDefinition,
  AssessmentFieldId,
  AssessmentValues,
  LIMB_SIDES,
  NutritionFunctionalAssessment,
} from './assessment.models';
import { AssessmentSource } from './assessment-source';
import { AssessmentWriter } from './assessment-writer';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export const SAVE_FAILED_HINT =
  'Não foi possível salvar a avaliação. Os valores digitados foram mantidos; tente novamente.';
export const OFFLINE_SAVE_HINT =
  'Sem conexão: salvar fica indisponível. Você pode continuar preenchendo; os valores serão mantidos.';

export const LOAD_FAILED_HINT = 'Não foi possível carregar a avaliação anterior. Os campos abrem vazios.';

/** Gasto energético simplificado (kcal/kg × peso); vazio se o peso não for um número positivo. */
function kcalPerKg(weight: string | undefined): number | null {
  const kg = Number((weight ?? '').trim().replace(',', '.'));

  return Number.isFinite(kg) && kg > 0 ? Math.round(kg * KCAL_PER_KG) : null;
}

/** Formata ISO como dd/MM (ano omitido, como no Figma 4682-9078). */
function shortDate(iso: string): string {
  const d = new Date(iso);

  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Seção "Avaliação Nutricional e Funcional" do Hub (FT-004-4, US-004-4-01): recolhida por padrão; ao
 * acionar, abre o formulário em duas sub-seções (bottom-sheet no mobile, diálogo centralizado no desktop).
 * Edição manual e salvar parcial (US-004-4-02); a IA fica para outra story.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent, PhIconComponent],
  selector: 'app-assessment-section',
  styleUrl: './assessment-section.component.scss',
  templateUrl: './assessment-section.component.html',
})
export class AssessmentSectionComponent {
  readonly patientId = input.required<string>();

  protected readonly sections = ASSESSMENT_SECTIONS;
  protected readonly limbSides = LIMB_SIDES;
  protected readonly assessment = signal<NutritionFunctionalAssessment | null>(null);
  protected readonly state = signal<LoadState>('idle');
  protected readonly loadFailedHint = LOAD_FAILED_HINT;
  protected readonly saveFailedHint = SAVE_FAILED_HINT;
  protected readonly offlineSaveHint = OFFLINE_SAVE_HINT;
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);
  protected readonly online = inject(ConnectivityService).online;
  /** Valores em edição (começam da avaliação carregada); campo ausente = vazio. */
  private readonly draft = signal<Partial<Record<AssessmentFieldId, string>>>({});

  private readonly source = inject(AssessmentSource);
  private readonly writer = inject(AssessmentWriter);
  private readonly isOpen = signal(false);
  /** Descarta respostas de uma abertura anterior (fechar e reabrir rápido, ou troca de paciente). */
  private token = 0;
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    effect(() => {
      const element = this.dialogRef()?.nativeElement;

      if (!element) {
        return;
      }
      if (this.isOpen() && !element.open) {
        element.showModal();
      } else if (!this.isOpen() && element.open) {
        element.close();
      }
    });
  }

  protected open(): void {
    this.saveFailed.set(false);
    this.isOpen.set(true);
    void this.load();
  }

  protected close(): void {
    this.token++;
    this.isOpen.set(false);
  }

  protected onDialogClick(event: MouseEvent): void {
    // Clique no ::backdrop chega com o próprio <dialog> como alvo.
    if (event.target instanceof HTMLDialogElement) {
      this.close();
    }
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  protected valueOf(id: AssessmentFieldId): string {
    return this.draft()[id] ?? '';
  }

  protected edit(id: AssessmentFieldId, value: string): void {
    this.draft.update(current => ({ ...current, [id]: value }));
  }

  /** Nenhum campo é obrigatório: salva o que houver, omitindo os vazios. */
  protected async save(): Promise<void> {
    if (this.saving() || !this.online() || this.state() === 'loading') {
      return;
    }
    const values: Partial<Record<AssessmentFieldId, string>> = {};

    for (const [id, value] of Object.entries(this.draft())) {
      if (value.trim() !== '' && id !== 'energyExpenditure' && id !== 'energySource') {
        values[id as AssessmentFieldId] = value;
      }
    }
    // A calorimetria informada prevalece; senão vale o kcal/kg (só com peso). A origem vai junto.
    const calculated = kcalPerKg(values.weight);

    if (values.indirectCalorimetry !== undefined) {
      values.energyExpenditure = values.indirectCalorimetry;
      values.energySource = ENERGY_SOURCE_CALORIMETRY;
    } else if (calculated !== null) {
      values.energyExpenditure = String(calculated);
      values.energySource = ENERGY_SOURCE_KCAL_PER_KG;
    }
    // Membro sem valor é ignorado ao salvar.
    const orphanSides = new Set(
      ASSESSMENT_SECTIONS.flatMap(section => section.fields)
        .filter(field => field.sideId !== undefined && values[field.id] === undefined)
        .map(field => field.sideId),
    );
    const toSave = Object.fromEntries(
      Object.entries(values).filter(([id]) => !orphanSides.has(id as AssessmentFieldId)),
    );

    this.saving.set(true);
    this.saveFailed.set(false);
    try {
      await this.writer.save(this.patientId(), toSave as AssessmentValues);
      this.close();
    } catch {
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  /** Valor digitado sem membro: aviso em texto (não bloqueia o salvamento). */
  protected missingSide(field: AssessmentFieldDefinition): boolean {
    return field.sideId !== undefined && this.valueOf(field.id).trim() !== '' && this.valueOf(field.sideId) === '';
  }

  protected helpOf(field: AssessmentFieldDefinition): string {
    if (field.id === 'indirectCalorimetry' && this.valueOf(field.id).trim() === '') {
      const calculated = kcalPerKg(this.valueOf('weight'));

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

  private async load(): Promise<void> {
    const token = ++this.token;

    this.assessment.set(null);
    this.draft.set({});
    this.state.set('loading');
    try {
      const latest = await this.source.loadLatest(this.patientId());

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
