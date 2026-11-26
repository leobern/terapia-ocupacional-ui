import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { FieldCardComponent } from '../../../shared/components/field-card/field-card.component';
import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import {
  AssistantEditorController,
  type EditorAction,
} from '../../../shared/services/assistant-editor-controller.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { FormulasApi } from '../../pharmacy/formulas-api';
import { NutritionTargetsReader } from '../plan/nutrition-targets-reader';
import { formatNumber } from '../plan/plan-targets';
import {
  AdministrationModality,
  DEFAULT_PRESCRIPTION_ROUTES,
  evaluatePrescription,
  IntakeTargets,
  MODALITY_OPTIONS,
  PrescriptionDraft,
  PrescriptionFormula,
  toPrescription,
} from './prescription.models';
import { PrescriptionSource } from './prescription-source';

export const PRESCRIPTION_OFFLINE_HINT =
  'Conexão necessária para ajustar a prescrição. Reconecte para editar e salvar.';
export const PRESCRIPTION_SAVE_FAILED_HINT =
  'Não foi possível salvar a prescrição. O que você digitou foi mantido; tente novamente.';
export const PRESCRIPTION_LOAD_FAILED_HINT = 'Não foi possível carregar as fórmulas do hospital agora.';
export const NO_TARGET_HINT = 'Sem meta definida: a comparação com a meta está indisponível.';
export const EMPTY_CATALOG_HINT = 'Nenhuma fórmula padronizada para este hospital.';
export const NO_LAST_PRESCRIPTION_HINT = 'Este paciente ainda não tem prescrição anterior.';

const EMPTY: PrescriptionDraft = {
  formula: null,
  modality: 'continuous',
  nursingNotes: '',
  pauseTimes: [],
  startTime: '',
  volume: '',
};

/**
 * Prescrição no painel lateral conversacional (Thiago, 2026-11-25): fórmula, volume, modalidade, horários e orientações
 * em cards de um por linha, com o aporte calculado frente à meta. "Usar a última prescrição" e "Adicionar horário de
 * pausa" ficam como atalhos acima do campo de mensagem; a IA ainda não funciona. Substitui o antigo bottom sheet.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, FieldCardComponent],
  selector: 'app-prescription-editor',
  styleUrl: './prescription-editor.component.scss',
  templateUrl: './prescription-editor.component.html',
})
export class PrescriptionEditorComponent {
  readonly patientId = input.required<string>();
  readonly hospitalId = input.required<number>();
  /** Chamado depois de a prescrição virar a vigente. */
  readonly saved = input<() => void>(() => undefined);

  protected readonly online = inject(ConnectivityService).online;
  protected readonly modalityLabels = MODALITY_OPTIONS.map(o => o.label);
  protected readonly formulas = signal<readonly PrescriptionFormula[]>([]);
  protected readonly formulaNames = computed(() => this.formulas().map(f => f.name));
  protected readonly draft = signal<PrescriptionDraft>(EMPTY);
  protected readonly busy = signal(false);
  protected readonly hint = signal<string | null>(null);
  protected readonly touched = signal(false);
  protected readonly targets = signal<IntakeTargets | null>(null);
  protected readonly evaluation = computed(() => evaluatePrescription(this.draft(), this.targets()));
  protected readonly modalityLabel = computed(
    () => MODALITY_OPTIONS.find(o => o.id === this.draft().modality)?.label ?? '',
  );
  protected readonly continuous = computed(() => this.draft().modality === 'continuous');
  protected readonly density = computed(() => {
    const f = this.draft().formula;

    return f ? `${f.kcalPerMl ?? 0} kcal/mL · ${f.proteinPerMl ?? 0} g de proteína/mL` : '';
  });
  protected readonly intakeLines = computed(() => {
    const intake = this.evaluation().intake;

    if (intake === null) {
      return null;
    }
    const percent = (value: number | null): string => (value === null ? 'meta indisponível' : `${value}% da meta`);

    return {
      kcal: `${formatNumber(intake.kcal)} kcal (${percent(intake.kcalPercent)})`,
      protein: `${formatNumber(intake.protein)} g de proteína (${percent(intake.proteinPercent)})`,
      rate: `${formatNumber(intake.rateMlPerHour)} mL/h em ${formatNumber(intake.hours)} h de administração`,
    };
  });
  protected readonly emptyCatalogHint = EMPTY_CATALOG_HINT;
  protected readonly noTargetHint = NO_TARGET_HINT;

  private readonly catalog = inject(FormulasApi);
  private readonly targetsReader = inject(NutritionTargetsReader);
  private readonly prescriptions = inject(PrescriptionSource);
  private readonly professional = inject(ProfessionalProfileReader);
  private readonly assistant = inject(AiAssistantService);
  private readonly editor = inject(AssistantEditorController);
  private readonly now = inject(NOW);
  private loaded = false;

  constructor() {
    effect(() => {
      const patient = this.patientId();
      const hospital = this.hospitalId();

      if (!this.loaded) {
        this.loaded = true;
        void this.load(patient, hospital);
      }
    });
    effect(onCleanup => {
      const actions = computed<readonly EditorAction[]>(() => [
        { id: 'last', label: 'Usar a última prescrição' },
        ...(this.continuous() ? [] : [{ id: 'pause', label: 'Adicionar horário de pausa' }]),
        { id: 'save', label: 'Salvar' },
      ]);

      onCleanup(
        this.editor.attach({
          actions,
          placeholder: 'Escreva a sua mensagem',
          run: (action): void => {
            if (action === 'last') {
              void this.useLast();
            } else if (action === 'pause') {
              this.patch({ pauseTimes: [...this.draft().pauseTimes, ''] });
            } else {
              void this.save();
            }
          },
        }),
      );
    });
  }

  protected selectFormula(name: string): void {
    this.patch({ formula: this.formulas().find(f => f.name === name) ?? null });
  }

  protected setModality(label: string): void {
    const modality: AdministrationModality = MODALITY_OPTIONS.find(o => o.label === label)?.id ?? 'continuous';

    this.patch({ modality, pauseTimes: modality === 'continuous' ? [] : this.draft().pauseTimes });
  }

  protected setVolume(volume: string): void {
    this.patch({ volume });
  }

  protected setStart(startTime: string): void {
    this.patch({ startTime });
  }

  protected setNotes(nursingNotes: string): void {
    this.patch({ nursingNotes });
  }

  protected setPause(index: number, value: string): void {
    this.patch({ pauseTimes: this.draft().pauseTimes.map((p, i) => (i === index ? value : p)) });
  }

  protected removePause(index: number): void {
    this.patch({ pauseTimes: this.draft().pauseTimes.filter((_, i) => i !== index) });
  }

  /** Preenche o formulário com a última prescrição da via, para ajustar só o que mudou. */
  protected async useLast(): Promise<void> {
    try {
      const route = DEFAULT_PRESCRIPTION_ROUTES[0];
      const last = (await this.prescriptions.load(this.patientId())).find(p => p.route === route);

      if (!last) {
        this.hint.set(NO_LAST_PRESCRIPTION_HINT);

        return;
      }
      this.draft.set({
        formula: this.formulas().find(f => f.id === last.formulaId) ?? null,
        modality: last.modality,
        nursingNotes: last.nursingNotes,
        pauseTimes: last.pauseTimes,
        startTime: last.startTime,
        volume: String(last.volumeMl).replace('.', ','),
      });
      this.hint.set(null);
    } catch {
      this.hint.set(PRESCRIPTION_LOAD_FAILED_HINT);
    }
  }

  /** Confirma: a prescrição passa a ser a vigente. Falha ou offline mantém o formulário e o que foi digitado. */
  protected async save(): Promise<void> {
    this.touched.set(true);
    if (this.busy()) {
      return;
    }
    if (!this.online()) {
      this.hint.set(PRESCRIPTION_OFFLINE_HINT);

      return;
    }
    const route = DEFAULT_PRESCRIPTION_ROUTES[0];
    const prescription = toPrescription(this.draft(), {
      at: this.now().toISOString(),
      author: this.professional.read().name,
      route,
    });

    if (prescription === null) {
      return;
    }
    this.busy.set(true);
    try {
      // Substitui só a prescrição desta via; as demais vias ativas seguem como estavam.
      const others = (await this.prescriptions.load(this.patientId())).filter(p => p.route !== route);

      await this.prescriptions.save({ patientId: this.patientId(), prescriptions: [...others, prescription] });
      this.saved()();
      this.assistant.closePanel();
    } catch {
      this.hint.set(PRESCRIPTION_SAVE_FAILED_HINT);
    } finally {
      this.busy.set(false);
    }
  }

  private patch(change: Partial<PrescriptionDraft>): void {
    this.draft.update(d => ({ ...d, ...change }));
    this.hint.set(null);
  }

  private async load(patientId: string, hospitalId: number): Promise<void> {
    try {
      const [catalog, targets] = await Promise.all([
        this.catalog.listStandardizedForPatient(patientId, hospitalId),
        this.targetsReader.current(patientId),
      ]);

      this.formulas.set(catalog.filter(f => f.standardized));
      this.targets.set(targets);
    } catch {
      this.hint.set(PRESCRIPTION_LOAD_FAILED_HINT);
    }
  }
}
