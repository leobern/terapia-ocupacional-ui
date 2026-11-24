import {
  ChangeDetectionStrategy,
  Component,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { IconButtonComponent } from '../../../shared/components/icon-button/icon-button.component';
import { IconLogoComponent } from '../../../shared/components/icon-logo/icon-logo.component';
import {
  type InputChatAudioError,
  InputChatComponent,
} from '../../../shared/components/input-chat/input-chat.component';
import { TagComponent } from '../../../shared/components/tag/tag.component';
import { PhIconComponent } from '../../../shared/icons/ph-icon/ph-icon.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import {
  ASSESSMENT_SECTIONS,
  AssessmentFieldDefinition,
  AssessmentFieldId,
  AssessmentValues,
  ENERGY_SOURCE_CALORIMETRY,
  ENERGY_SOURCE_KCAL_PER_KG,
  KCAL_PER_KG,
  LIMB_SIDES,
  NutritionFunctionalAssessment,
} from './assessment.models';
import { AssessmentAiStructurer } from './assessment-ai-structurer';
import { AssessmentSource } from './assessment-source';
import { AssessmentWriter } from './assessment-writer';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export const SAVE_FAILED_HINT =
  'Não foi possível salvar a avaliação. Os valores digitados foram mantidos; tente novamente.';
export const OFFLINE_SAVE_HINT =
  'Sem conexão: salvar fica indisponível. Você pode continuar preenchendo; os valores serão mantidos.';

export const AI_UNAVAILABLE_HINT = 'Preenchimento por IA indisponível. Preencha manualmente.';
export const AI_FAILED_HINT =
  'Não foi possível preencher por IA. Os valores do formulário foram mantidos; tente de novo ou preencha manualmente.';
export const MIC_DENIED_HINT = 'Sem acesso ao microfone. Preencha manualmente ou permita o microfone e tente de novo.';
export const MIC_FAILED_HINT = 'Não foi possível gravar o áudio. Preencha manualmente ou tente de novo.';
export const AI_REVIEW_NOTE = 'Alguns campos foram preenchidos pela IA. Revise antes de salvar.';
export const AI_PROCESSING_HINT = 'Processando o áudio…';

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
  imports: [IconLogoComponent, ButtonComponent, IconButtonComponent, InputChatComponent, PhIconComponent, TagComponent],
  selector: 'app-assessment-section',
  styleUrl: './assessment-section.component.scss',
  templateUrl: './assessment-section.component.html',
})
export class AssessmentSectionComponent {
  readonly patientId = input.required<string>();
  /** Avaliação concluída pelo profissional: o Hub abre o Diagnóstico (FT-004-5) se houver triagem positiva. */
  readonly concluded = output();

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
  /** Campos (card) preenchidos pela IA e ainda não revisados; só no rascunho, nunca gravado. */
  protected readonly suggested = signal<ReadonlySet<AssessmentFieldId>>(new Set());
  protected readonly aiProcessing = signal(false);
  /** Aviso de falha da IA/microfone (a indisponibilidade por falta de conexão vem de `online`). */
  protected readonly aiNotice = signal<string | null>(null);
  protected readonly aiUnavailableHint = AI_UNAVAILABLE_HINT;
  protected readonly aiReviewNote = AI_REVIEW_NOTE;
  protected readonly aiProcessingHint = AI_PROCESSING_HINT;
  /** Valores em edição (começam da avaliação carregada); campo ausente = vazio. */
  private readonly draft = signal<Partial<Record<AssessmentFieldId, string>>>({});

  private readonly source = inject(AssessmentSource);
  private readonly writer = inject(AssessmentWriter);
  private readonly structurer = inject(AssessmentAiStructurer);
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
    this.resetAi();
    this.isOpen.set(true);
    void this.load();
  }

  protected close(): void {
    this.token++;
    this.resetAi();
    this.isOpen.set(false);
  }

  protected conclude(): void {
    this.close();
    this.concluded.emit();
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
    this.unmark(id);
  }

  protected isSuggested(field: AssessmentFieldDefinition): boolean {
    return this.suggested().has(field.id);
  }

  /** Áudio gravado: a IA estrutura os campos no rascunho; nunca salva. */
  protected async onAudio(audio: Blob): Promise<void> {
    if (!this.online()) {
      return;
    }
    const token = this.token;

    this.aiNotice.set(null);
    this.aiProcessing.set(true);
    try {
      const result = await this.structurer.structure(audio);

      // Fechou/reabriu, ou a conexão caiu: descarta só o áudio, sem tocar no formulário.
      if (token !== this.token || !this.online()) {
        if (token === this.token) {
          this.aiNotice.set(AI_FAILED_HINT);
        }

        return;
      }
      this.applyStructured(result);
    } catch {
      if (token === this.token) {
        this.aiNotice.set(AI_FAILED_HINT);
      }
    } finally {
      if (token === this.token) {
        this.aiProcessing.set(false);
      }
    }
  }

  protected onAudioError(reason: InputChatAudioError): void {
    this.aiNotice.set(reason === 'permission-denied' ? MIC_DENIED_HINT : MIC_FAILED_HINT);
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
      this.conclude();
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

  /** Campos citados sobrescrevem; os demais não são tocados. Valor fora das opções é descartado. */
  private applyStructured(result: Readonly<Partial<Record<AssessmentFieldId, string>>>): void {
    const fields = ASSESSMENT_SECTIONS.flatMap(section => section.fields);
    const next = { ...this.draft() };
    const marked = new Set(this.suggested());

    for (const field of fields) {
      const accepted: [AssessmentFieldId, string][] = [];
      const value = result[field.id]?.trim();

      if (value && (field.options === undefined || field.options.includes(value))) {
        accepted.push([field.id, value]);
      }
      const side = field.sideId === undefined ? undefined : result[field.sideId]?.trim();

      if (field.sideId !== undefined && side && LIMB_SIDES.includes(side)) {
        accepted.push([field.sideId, side]);
      }
      for (const [id, acceptedValue] of accepted) {
        next[id] = acceptedValue;
        marked.add(field.id);
      }
    }
    this.draft.set(next);
    this.suggested.set(marked);
  }

  /** Editar um campo (ou o seu membro) o torna dado do profissional: some a marca da IA. */
  private unmark(id: AssessmentFieldId): void {
    const owner = ASSESSMENT_SECTIONS.flatMap(section => section.fields).find(
      field => field.id === id || field.sideId === id,
    )?.id;

    if (owner !== undefined && this.suggested().has(owner)) {
      this.suggested.update(current => new Set([...current].filter(item => item !== owner)));
    }
  }

  private resetAi(): void {
    this.suggested.set(new Set());
    this.aiProcessing.set(false);
    this.aiNotice.set(null);
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
