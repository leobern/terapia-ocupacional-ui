import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { AssessmentSource } from '../assessment/assessment-source';
import { PlanSource } from './plan-source';
import {
  CalculatedWeights,
  computeTargets,
  DEFAULT_CALORIMETRY_PERCENT,
  DEFAULT_KCAL_PER_KG,
  formatNumber,
  formatWeight,
  MAX_CALORIMETRY_PERCENT,
  NutritionTargets,
  parsePositive,
  PROTEIN_PER_KG,
  REFERENCE_WEIGHT_OPTIONS,
  ReferenceWeight,
  ReferenceWeightKind,
  referenceWeightLabel,
  TARGET_FORMULA_LABELS,
  TargetFormula,
} from './plan-targets';

export const WEIGHTS_FAILED_HINT = 'Não foi possível ler os pesos calculados na Avaliação agora.';
export const WEIGHTS_MISSING_HINT =
  'Sem peso calculado na Avaliação nutricional: preencha a Avaliação para escolher o peso de referência.';
export const CALORIMETRY_FAILED_HINT = 'Não foi possível ler a calorimetria indireta; metas pela fórmula simplificada.';
export const NO_REFERENCE_HINT = 'Selecione o peso de referência para calcular as metas.';
export const INVALID_FACTOR_HINT = 'Informe fatores kcal/kg e g/kg numéricos maiores que zero.';
export const INVALID_PERCENT_HINT = `Informe um percentual da calorimetria maior que zero e até ${MAX_CALORIMETRY_PERCENT}%.`;

/** Quem grava e quando; a mesma assinatura da trilha de auditoria da FT-004-6. */
export interface TargetsCommitMeta {
  readonly at: string;
  readonly author: string;
  readonly patientId: string;
}

/** Peso e metas a gravar (`null` = nada mudou) ou o erro de validação das entradas em edição. */
export interface PendingTargets {
  readonly error: string | null;
  readonly reference: ReferenceWeight | null;
  readonly targets: NutritionTargets | null;
}

/**
 * Mecanismo de definição de meta calórica/proteica (FT-004-6), reutilizado pelo Plano de Intervenção e pela
 * revisão diária da prescrição (FT-004-8, FR-011): peso de referência, fórmula, fatores por kg, metas
 * derivadas e gravação (com autor e data/hora na trilha de auditoria). Única implementação do cálculo.
 * Quem hospeda decide quando gravar: `pending()` valida e `commit()` grava peso e metas, emitindo `saved`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-targets-editor',
  styleUrl: './targets-editor.component.scss',
  templateUrl: './targets-editor.component.html',
})
export class TargetsEditorComponent {
  readonly patientId = input.required<string>();
  /** Só o médico edita; os demais perfis apenas consultam. */
  readonly editable = input(true);
  /** Metas gravadas: quem hospeda recalcula a % de adequação (cálculo único). */
  readonly saved = output();
  /** O médico mexeu em peso, fórmula ou fatores (quem hospeda limpa avisos antigos). */
  readonly edited = output();

  protected readonly formulaLabels = TARGET_FORMULA_LABELS;
  protected readonly formulaOptions: readonly TargetFormula[] = ['simplified', 'indirect-calorimetry'];
  protected readonly formatNumber = formatNumber;
  protected readonly referenceWeightLabel = referenceWeightLabel;
  protected readonly weightsFailedHint = WEIGHTS_FAILED_HINT;
  protected readonly weightsMissingHint = WEIGHTS_MISSING_HINT;
  protected readonly calorimetryFailedHint = CALORIMETRY_FAILED_HINT;
  protected readonly noReferenceHint = NO_REFERENCE_HINT;
  protected readonly connectivity = inject(ConnectivityService);

  /** Pesos calculados na Avaliação (só leitura) e a escolha em edição; só vira salva em `commit`. */
  protected readonly weights = signal<CalculatedWeights>({});
  protected readonly weightsFailed = signal(false);
  protected readonly savedReference = signal<ReferenceWeight | null>(null);
  protected readonly referenceKind = signal<ReferenceWeightKind | null>(null);
  protected readonly weightOptions = computed(() =>
    REFERENCE_WEIGHT_OPTIONS.flatMap(option => {
      const kg = this.weights()[option.id];

      return kg === undefined ? [] : [{ ...option, kg, text: `${option.label} · ${formatWeight(kg)}` }];
    }),
  );
  /** Peso escolhido em kg; mantém o valor salvo se o peso calculado deixou de vir da Avaliação. */
  protected readonly reference = computed<ReferenceWeight | null>(() => {
    const kind = this.referenceKind();

    if (kind === null) {
      return null;
    }
    const kg = this.weights()[kind] ?? (this.savedReference()?.kind === kind ? this.savedReference()?.kg : undefined);

    return kg === undefined ? null : { kg, kind };
  });
  protected readonly referenceText = computed(() => {
    const saved = this.savedReference();

    return saved === null ? 'Sem peso de referência' : referenceWeightLabel(saved);
  });

  /** Metas salvas, entradas em edição (texto digitado) e metas derivadas da edição. */
  protected readonly savedTargets = signal<NutritionTargets | null>(null);
  protected readonly kcalFactor = signal(formatNumber(DEFAULT_KCAL_PER_KG));
  protected readonly proteinFactor = signal(formatNumber(PROTEIN_PER_KG));
  protected readonly formula = signal<TargetFormula>('simplified');
  protected readonly percent = signal(formatNumber(DEFAULT_CALORIMETRY_PERCENT));
  protected readonly calorimetry = signal<number | null>(null);
  protected readonly calorimetryFailed = signal(false);
  /** Metas exibidas: as salvas até o médico mexer; depois, as derivadas da edição. */
  protected readonly shownTargets = computed(() =>
    this.targetsTouched() || this.savedTargets() === null ? this.draft().targets : this.savedTargets(),
  );
  protected readonly draft = computed<{ error: string | null; targets: NutritionTargets | null }>(() => {
    const reference = this.reference();

    if (reference === null) {
      return { error: null, targets: null };
    }
    const kcalPerKg = parsePositive(this.kcalFactor());
    const proteinPerKg = parsePositive(this.proteinFactor());
    const kcal = this.calorimetry();
    const byCalorimetry = this.formula() === 'indirect-calorimetry' && kcal !== null;
    const percent = parsePositive(this.percent());

    if (proteinPerKg === null || (!byCalorimetry && kcalPerKg === null)) {
      return { error: INVALID_FACTOR_HINT, targets: null };
    }
    if (byCalorimetry && (percent === null || percent > MAX_CALORIMETRY_PERCENT)) {
      return { error: INVALID_PERCENT_HINT, targets: null };
    }

    return {
      error: null,
      targets: computeTargets({
        calorimetry: byCalorimetry && percent !== null ? { kcal, percent } : null,
        kcalPerKg: kcalPerKg ?? DEFAULT_KCAL_PER_KG,
        proteinPerKg,
        referenceWeight: reference,
      }),
    };
  });

  private readonly targetsTouched = signal(false);
  private readonly factorSignals = { kcal: this.kcalFactor, percent: this.percent, protein: this.proteinFactor };
  private readonly source = inject(PlanSource);
  private readonly assessmentSource = inject(AssessmentSource);
  /** Descarta respostas de uma carga anterior (troca de paciente). */
  private token = 0;

  constructor() {
    effect(() => {
      const id = this.patientId();

      untracked(() => void this.load(id));
    });
  }

  /** Metas atuais (salvas ou derivadas da edição); usado por quem hospeda para exibir a meta vigente. */
  currentTargets(): NutritionTargets | null {
    return this.shownTargets();
  }

  /** Peso e metas a gravar (`null` = nada mudou) ou o erro de validação das entradas em edição. */
  pending(): PendingTargets {
    const chosen = this.reference();
    const saved = this.savedReference();
    const { error, targets } = this.draft();
    const referenceChanged = chosen !== null && (saved?.kind !== chosen.kind || saved.kg !== chosen.kg);
    const targetsChanged = targets !== null && (this.targetsTouched() || this.savedTargets() === null);

    return {
      error,
      reference: referenceChanged ? chosen : null,
      targets: targetsChanged ? targets : null,
    };
  }

  /** Grava peso e metas pendentes (nesta ordem); emite `saved` quando as metas foram gravadas. */
  async commit(meta: TargetsCommitMeta, pending: PendingTargets = this.pending()): Promise<void> {
    const { at, author, patientId } = meta;

    if (pending.reference !== null) {
      this.savedReference.set(
        await this.source.saveReferenceWeight({ at, author, patientId, weight: pending.reference }),
      );
    }
    if (pending.targets !== null) {
      this.savedTargets.set(await this.source.saveTargets({ at, author, patientId, targets: pending.targets }));
      this.targetsTouched.set(false);
      this.saved.emit();
    }
  }

  protected chooseReference(kind: ReferenceWeightKind): void {
    if (!this.editable() || !this.connectivity.online()) {
      return;
    }
    this.edited.emit();
    this.targetsTouched.set(true);
    this.referenceKind.set(kind);
  }

  protected chooseFormula(formula: TargetFormula): void {
    this.edited.emit();
    this.targetsTouched.set(true);
    this.formula.set(formula);
  }

  protected setFactor(which: 'kcal' | 'protein' | 'percent', event: Event): void {
    this.edited.emit();
    this.targetsTouched.set(true);
    this.factorSignals[which].set((event.target as HTMLInputElement).value);
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;

    this.weights.set({});
    this.weightsFailed.set(false);
    this.savedReference.set(null);
    this.referenceKind.set(null);
    this.savedTargets.set(null);
    this.calorimetry.set(null);
    this.calorimetryFailed.set(false);
    this.formula.set('simplified');
    this.kcalFactor.set(formatNumber(DEFAULT_KCAL_PER_KG));
    this.proteinFactor.set(formatNumber(PROTEIN_PER_KG));
    this.percent.set(formatNumber(DEFAULT_CALORIMETRY_PERCENT));
    this.targetsTouched.set(false);
    void this.loadWeights(patientId, token);
    void this.loadCalorimetry(patientId, token);
    const [reference, targets] = await Promise.all([
      this.source.loadReferenceWeight(patientId).catch(() => null),
      this.source.loadTargets(patientId).catch(() => null),
    ]);

    if (token === this.token) {
      this.savedReference.set(reference);
      this.referenceKind.set(reference?.kind ?? null);
      this.savedTargets.set(targets);
      this.restoreTargetInputs(targets);
    }
  }

  /** Repõe fatores e origem salvos; a calorimetria só vale na edição se ainda existir na Avaliação. */
  private restoreTargetInputs(targets: NutritionTargets | null): void {
    if (targets === null) {
      return;
    }
    this.kcalFactor.set(formatNumber(targets.kcalPerKg));
    this.proteinFactor.set(formatNumber(targets.proteinPerKg));
    if (targets.calorimetry) {
      this.percent.set(formatNumber(targets.calorimetry.percent));
      this.formula.set('indirect-calorimetry');
    }
  }

  /** Falha ao ler os pesos degrada só o seletor. */
  private async loadWeights(patientId: string, token: number): Promise<void> {
    try {
      const weights = await this.source.loadCalculatedWeights(patientId);

      if (token === this.token) {
        this.weights.set(weights);
      }
    } catch {
      if (token === this.token) {
        this.weightsFailed.set(true);
      }
    }
  }

  /** Reaproveita a leitura da Avaliação (sem recoleta, FR-019); falha degrada para a fórmula simplificada. */
  private async loadCalorimetry(patientId: string, token: number): Promise<void> {
    try {
      const latest = await this.assessmentSource.loadLatest(patientId);

      if (token === this.token) {
        this.calorimetry.set(parsePositive(latest?.values.indirectCalorimetry ?? ''));
      }
    } catch {
      if (token === this.token) {
        this.calorimetryFailed.set(true);
      }
    }
  }
}
