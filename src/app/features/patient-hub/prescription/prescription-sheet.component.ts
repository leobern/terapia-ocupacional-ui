import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { IconButtonComponent } from '../../../shared/components/icon-button/icon-button.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { DailyAdequacy } from '../../daily-evolution/adequacy/adequacy.models';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { FormulasApi } from '../../pharmacy/formulas-api';
import { NutritionTargetsReader } from '../plan/nutrition-targets-reader';
import { formatNumber } from '../plan/plan-targets';
import {
  AdministrationModality,
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

const EMPTY: PrescriptionDraft = {
  formula: null,
  modality: 'continuous',
  nursingNotes: '',
  pauseTimes: [],
  startTime: '',
  volume: '',
};

/**
 * Revisão da prescrição (FT-004-8, US-004-8-02; Figma 4718-10198, desenhado pelo agente): ajuste de
 * fórmula, volume, modalidade, horários e orientações, com aporte calculado em tempo real frente à meta.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent],
  selector: 'app-prescription-sheet',
  styleUrl: './prescription-sheet.component.scss',
  templateUrl: './prescription-sheet.component.html',
})
export class PrescriptionSheetComponent {
  readonly open = input(false);
  readonly patientId = input.required<string>();
  readonly hospitalId = input.required<string>();
  readonly adequacy = input<DailyAdequacy | null>(null);
  readonly closed = output();
  /** Emite depois de a prescrição virar a vigente. */
  readonly saved = output();

  protected readonly online = inject(ConnectivityService).online;
  protected readonly modalities = MODALITY_OPTIONS;
  protected readonly formulas = signal<readonly PrescriptionFormula[]>([]);
  protected readonly draft = signal<PrescriptionDraft>(EMPTY);
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly touched = signal(false);
  protected readonly offlineHint = PRESCRIPTION_OFFLINE_HINT;
  protected readonly saveFailedHint = PRESCRIPTION_SAVE_FAILED_HINT;
  protected readonly loadFailedHint = PRESCRIPTION_LOAD_FAILED_HINT;
  protected readonly noTargetHint = NO_TARGET_HINT;
  protected readonly emptyCatalogHint = EMPTY_CATALOG_HINT;
  protected readonly targets = signal<IntakeTargets | null>(null);
  protected readonly evaluation = computed(() => evaluatePrescription(this.draft(), this.targets()));
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
  protected readonly banner = computed(() => {
    const a = this.adequacy();

    return a?.status === 'available'
      ? `Adequação atual: ${a.calories.percent}% da meta calórica e ${a.protein.percent}% da proteica.`
      : 'Adequação atual indisponível.';
  });
  protected readonly canSave = computed(
    () => this.online() && this.evaluation().valid && !this.saving() && this.formulas().length > 0,
  );

  private readonly catalog = inject(FormulasApi);
  private readonly targetsReader = inject(NutritionTargetsReader);
  private readonly prescriptions = inject(PrescriptionSource);
  private readonly professional = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  private token = 0;
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    effect(() => {
      const element = this.dialogRef()?.nativeElement;
      const isOpen = this.open();

      if (!element) {
        return;
      }
      if (isOpen && !element.open) {
        element.showModal();
      } else if (!isOpen && element.open) {
        element.close();
      }
    });
    effect(() => {
      if (this.open()) {
        const patient = this.patientId();
        const hospital = this.hospitalId();

        untracked(() => void this.load(patient, hospital));
      }
    });
  }

  protected selectFormula(id: string): void {
    this.patch({ formula: this.formulas().find(f => f.id === id) ?? null });
  }

  protected setModality(modality: AdministrationModality): void {
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

  protected addPause(): void {
    this.patch({ pauseTimes: [...this.draft().pauseTimes, ''] });
  }

  protected setPause(index: number, value: string): void {
    this.patch({ pauseTimes: this.draft().pauseTimes.map((p, i) => (i === index ? value : p)) });
  }

  protected removePause(index: number): void {
    this.patch({ pauseTimes: this.draft().pauseTimes.filter((_, i) => i !== index) });
  }

  protected isContinuous(): boolean {
    return this.draft().modality === 'continuous';
  }

  protected close(): void {
    this.closed.emit();
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

  /** Confirma: a prescrição passa a ser a vigente. Falha ou offline mantém o formulário e o que foi digitado. */
  protected async save(): Promise<void> {
    this.touched.set(true);
    this.saveFailed.set(false);
    const prescription = toPrescription(this.draft(), {
      at: this.now().toISOString(),
      author: this.professional.read().name,
    });

    if (!this.online() || prescription === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    try {
      await this.prescriptions.save({ patientId: this.patientId(), prescription });
      this.saved.emit();
      this.close();
    } catch {
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  private patch(change: Partial<PrescriptionDraft>): void {
    this.draft.update(d => ({ ...d, ...change }));
    this.saveFailed.set(false);
  }

  private async load(patientId: string, hospitalId: string): Promise<void> {
    const token = ++this.token;

    this.draft.set(EMPTY);
    this.touched.set(false);
    this.saveFailed.set(false);
    this.loadFailed.set(false);
    try {
      const [catalog, targets] = await Promise.all([
        this.catalog.list(hospitalId),
        this.targetsReader.current(patientId),
      ]);

      if (token === this.token) {
        this.formulas.set(catalog.filter(f => f.standardized));
        this.targets.set(targets);
      }
    } catch {
      if (token === this.token) {
        this.formulas.set([]);
        this.targets.set(null);
        this.loadFailed.set(true);
      }
    }
  }
}
