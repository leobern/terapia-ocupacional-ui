import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { AssessmentSource } from '../assessment/assessment-source';
import {
  ConductFlag,
  CurrentRoute,
  normalizeRoutes,
  NUTRITION_ROUTES,
  NutritionRoute,
  routeLabel,
  SWALLOWING_OPTIONS,
  SwallowingDecision,
  swallowingLabel,
} from './plan.models';
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
import { RefeedingRisk, RefeedingRiskSource } from './refeeding-risk-source';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export const LOAD_FAILED_HINT = 'Não foi possível carregar a via vigente. Tente novamente em instantes.';
export const SAVE_FAILED_HINT = 'Não foi possível salvar o plano. A seleção foi mantida; tente novamente.';
export const RISK_FAILED_HINT = 'Não foi possível verificar o risco de síndrome de realimentação agora.';
export const DYSPHAGIA_FAILED_HINT = 'Não foi possível ler o risco de disfagia da Avaliação agora.';
export const DYSPHAGIA_MISSING_HINT = 'Risco de disfagia ainda não registrado na Avaliação nutricional.';
export const OFFLINE_HINT = 'Sem conexão: não é possível salvar o plano agora.';
export const FLAGS_FAILED_HINT = 'Não foi possível carregar as sinalizações de mudança de conduta agora.';
export const FLAG_SAVE_FAILED_HINT = 'Não foi possível registrar a sinalização. O texto foi mantido; tente novamente.';
export const FLAG_OFFLINE_HINT = 'Sem conexão: não é possível registrar a sinalização agora.';
export const FLAG_EMPTY_HINT = 'Escreva a sugestão de mudança de conduta para sinalizar.';
export const WEIGHTS_FAILED_HINT = 'Não foi possível ler os pesos calculados na Avaliação agora.';
export const WEIGHTS_MISSING_HINT =
  'Sem peso calculado na Avaliação nutricional: preencha a Avaliação para escolher o peso de referência.';
export const CALORIMETRY_FAILED_HINT = 'Não foi possível ler a calorimetria indireta; metas pela fórmula simplificada.';
export const NO_REFERENCE_HINT = 'Selecione o peso de referência para calcular as metas.';
export const INVALID_FACTOR_HINT = 'Informe fatores kcal/kg e g/kg numéricos maiores que zero.';
export const INVALID_PERCENT_HINT = `Informe um percentual da calorimetria maior que zero e até ${MAX_CALORIMETRY_PERCENT}%.`;
export const EMPTY_SELECTION_HINT = 'Selecione ao menos uma via de nutrição para salvar.';

/** Formata ISO como dd/MM/aaaa HH:mm. */
function fullDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number): string => String(n).padStart(2, '0');

  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Formata ISO como dd/MM (ano omitido, como no Figma 4716-9503). */
function shortDate(iso: string): string {
  const d = new Date(iso);

  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Seção "Plano de intervenção" do Hub (FT-004-6, US-004-6-01): linha que abre o plano quando o profissional
 * quiser (sem abertura automática). Só o médico define/altera a via; os demais perfis só consultam.
 * A via só muda por salvamento explícito — reavaliações não passam por aqui.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent, PhIconComponent],
  selector: 'app-plan-section',
  styleUrl: './plan-section.component.scss',
  templateUrl: './plan-section.component.html',
})
export class PlanSectionComponent {
  readonly patientId = input.required<string>();

  protected readonly options = NUTRITION_ROUTES;
  protected readonly current = signal<CurrentRoute | null>(null);
  protected readonly swallowingOptions = SWALLOWING_OPTIONS;
  /** Decisão salva e a escolha em edição (a escolha só vira salva em "Salvar plano"). */
  protected readonly savedSwallowing = signal<SwallowingDecision | null>(null);
  protected readonly swallowing = signal<SwallowingDecision | null>(null);
  protected readonly swallowingText = computed(
    () => swallowingLabel(this.savedSwallowing()) || 'Sem decisão registrada',
  );
  protected readonly flags = signal<readonly ConductFlag[]>([]);
  protected readonly flagsFailed = signal(false);
  protected readonly flagsFailedHint = FLAGS_FAILED_HINT;
  protected readonly flagDraft = signal('');
  protected readonly flagHint = signal<string | null>(null);
  protected readonly flagSaving = signal(false);
  protected readonly flagOfflineHint = FLAG_OFFLINE_HINT;
  protected readonly selection = signal<readonly NutritionRoute[]>([]);
  protected readonly state = signal<LoadState>('idle');
  protected readonly saving = signal(false);
  protected readonly hint = signal<string | null>(null);
  protected readonly risk = signal<RefeedingRisk | null>(null);
  protected readonly riskFailed = signal(false);
  /** Risco de disfagia da Avaliação (FT-004-4), só leitura; `null` = não registrado. */
  protected readonly dysphagia = signal<string | null>(null);
  protected readonly dysphagiaFailed = signal(false);
  protected readonly dysphagiaFailedHint = DYSPHAGIA_FAILED_HINT;
  protected readonly dysphagiaHelp = computed(() => {
    const value = this.dysphagia();

    return value === null
      ? DYSPHAGIA_MISSING_HINT
      : `Risco de disfagia: ${value.replace(/^Risco /u, '').toLowerCase()} (Avaliação nutricional).`;
  });
  protected readonly riskFailedHint = RISK_FAILED_HINT;
  protected readonly weightsFailedHint = WEIGHTS_FAILED_HINT;
  protected readonly weightsMissingHint = WEIGHTS_MISSING_HINT;
  protected readonly calorimetryFailedHint = CALORIMETRY_FAILED_HINT;
  protected readonly noReferenceHint = NO_REFERENCE_HINT;
  protected readonly formulaLabels = TARGET_FORMULA_LABELS;
  protected readonly formulaOptions: readonly TargetFormula[] = ['simplified', 'indirect-calorimetry'];
  protected readonly formatNumber = formatNumber;
  protected readonly formatWeight = formatWeight;
  protected readonly referenceWeightLabel = referenceWeightLabel;

  /** Pesos calculados na Avaliação (só leitura) e a escolha em edição; só vira salva em "Salvar plano". */
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
  protected readonly connectivity = inject(ConnectivityService);
  protected readonly isDoctor = inject(ProfessionalProfileReader).read().role === 'doctor';
  protected readonly loadFailedHint = LOAD_FAILED_HINT;
  protected readonly offlineHint = OFFLINE_HINT;
  protected readonly currentLabel = computed(() => {
    const c = this.current();

    return c === null ? '' : routeLabel(c.routes);
  });
  protected readonly help = computed(() => {
    const c = this.current();
    const rule = 'Só o médico altera; reavaliar não muda a via.';

    return c === null ? `Ainda sem via definida. ${rule}` : `Desde ${shortDate(c.since)}. ${rule}`;
  });

  private readonly targetsTouched = signal(false);
  private readonly factorSignals = { kcal: this.kcalFactor, percent: this.percent, protein: this.proteinFactor };
  private readonly source = inject(PlanSource);
  private readonly assessmentSource = inject(AssessmentSource);
  private readonly riskSource = inject(RefeedingRiskSource);
  private readonly profile = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
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

  protected chooseSwallowing(id: SwallowingDecision): void {
    if (!this.isDoctor || !this.connectivity.online()) {
      return;
    }
    this.hint.set(null);
    this.swallowing.set(id);
  }

  protected formatFlagDate(iso: string): string {
    return fullDateTime(iso);
  }

  protected onFlagInput(event: Event): void {
    this.flagHint.set(null);
    this.flagDraft.set((event.target as HTMLTextAreaElement).value);
  }

  /** Registra a sinalização (só não-médico, online, com texto); não toca na via nem no formulário do médico. */
  protected async sendFlag(): Promise<void> {
    if (this.isDoctor || this.flagSaving()) {
      return;
    }
    if (!this.connectivity.online()) {
      this.flagHint.set(FLAG_OFFLINE_HINT);

      return;
    }
    const text = this.flagDraft().trim();

    if (text === '') {
      this.flagHint.set(FLAG_EMPTY_HINT);

      return;
    }
    this.flagSaving.set(true);
    this.flagHint.set(null);
    try {
      const flag = await this.source.addConductFlag({
        at: this.now().toISOString(),
        author: this.profile.read().name,
        patientId: this.patientId(),
        text,
      });

      this.flags.update(list => [...list, flag]);
      this.flagDraft.set('');
    } catch {
      this.flagHint.set(FLAG_SAVE_FAILED_HINT);
    } finally {
      this.flagSaving.set(false);
    }
  }

  protected chooseReference(kind: ReferenceWeightKind): void {
    if (!this.isDoctor || !this.connectivity.online()) {
      return;
    }
    this.hint.set(null);
    this.targetsTouched.set(true);
    this.referenceKind.set(kind);
  }

  protected chooseFormula(formula: TargetFormula): void {
    this.hint.set(null);
    this.targetsTouched.set(true);
    this.formula.set(formula);
  }

  protected setFactor(which: 'kcal' | 'protein' | 'percent', event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.hint.set(null);
    this.targetsTouched.set(true);
    this.factorSignals[which].set(value);
  }

  protected isSelected(id: NutritionRoute): boolean {
    return this.selection().includes(id);
  }

  protected toggle(id: NutritionRoute): void {
    if (!this.isDoctor) {
      return;
    }
    this.hint.set(null);
    this.selection.update(list => normalizeRoutes(list.includes(id) ? list.filter(r => r !== id) : [...list, id]));
  }

  /** Grava a seleção como nova via vigente; só o médico, online e com ao menos uma via. */
  protected async save(): Promise<void> {
    if (!this.isDoctor || this.saving()) {
      return;
    }
    if (!this.connectivity.online()) {
      this.hint.set(OFFLINE_HINT);

      return;
    }
    const routeChanged = this.selection().length > 0 && this.routeDiffers();
    const swallowingChanged = this.swallowing() !== null && this.swallowing() !== this.savedSwallowing();
    const { error, reference, targets } = this.pendingTargets();

    if (error !== null) {
      this.hint.set(error);

      return;
    }
    if (this.selection().length === 0 && !swallowingChanged && reference === null && targets === null) {
      this.hint.set(EMPTY_SELECTION_HINT);

      return;
    }
    this.saving.set(true);
    this.hint.set(null);
    try {
      const at = this.now().toISOString();
      const author = this.profile.read().name;
      const patientId = this.patientId();
      const decision = this.swallowing();

      if (routeChanged) {
        const saved = await this.source.saveRoute({ at, author, patientId, routes: this.selection() });

        this.current.set(saved);
        this.selection.set(saved.routes);
      }
      if (swallowingChanged && decision !== null) {
        this.savedSwallowing.set(await this.source.saveSwallowing({ at, author, decision, patientId }));
      }
      if (reference !== null) {
        this.savedReference.set(await this.source.saveReferenceWeight({ at, author, patientId, weight: reference }));
      }
      if (targets !== null) {
        this.savedTargets.set(await this.source.saveTargets({ at, author, patientId, targets }));
        this.targetsTouched.set(false);
      }
    } catch {
      this.hint.set(SAVE_FAILED_HINT);
    } finally {
      this.saving.set(false);
    }
  }

  /** Peso e metas a gravar (`null` = nada mudou) ou o erro de validação das entradas em edição. */
  private pendingTargets(): {
    error: string | null;
    reference: ReferenceWeight | null;
    targets: NutritionTargets | null;
  } {
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

  /** Só regrava a via quando mudou (salvar a decisão sozinha não renova "desde quando" da via). */
  private routeDiffers(): boolean {
    const current = this.current();

    return current === null || routeLabel(current.routes) !== routeLabel(this.selection());
  }

  private async load(): Promise<void> {
    const token = ++this.token;

    this.current.set(null);
    this.selection.set([]);
    this.savedSwallowing.set(null);
    this.swallowing.set(null);
    this.hint.set(null);
    this.risk.set(null);
    this.riskFailed.set(false);
    this.dysphagia.set(null);
    this.dysphagiaFailed.set(false);
    this.flags.set([]);
    this.flagsFailed.set(false);
    this.flagDraft.set('');
    this.flagHint.set(null);
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
    this.state.set('loading');
    void this.loadFlags(token);
    void this.loadWeights(token);
    void this.loadRisk(token);
    void this.loadDysphagia(token);
    try {
      const [latest, decision] = await Promise.all([
        this.source.loadRoute(this.patientId()),
        this.source.loadSwallowing(this.patientId()),
      ]);
      const [reference, targets] = await Promise.all([
        this.source.loadReferenceWeight(this.patientId()).catch(() => null),
        this.source.loadTargets(this.patientId()).catch(() => null),
      ]);

      if (token === this.token) {
        this.savedSwallowing.set(decision);
        this.swallowing.set(decision);
        this.current.set(latest);
        this.selection.set(latest?.routes ?? []);
        this.savedReference.set(reference);
        this.referenceKind.set(reference?.kind ?? null);
        this.savedTargets.set(targets);
        this.restoreTargetInputs(targets);
        this.state.set('ready');
      }
    } catch {
      if (token === this.token) {
        this.state.set('error');
      }
    }
  }

  /** Independente do resto do Plano: falha só avisa em texto na área de sinalizações. */
  private async loadFlags(token: number): Promise<void> {
    try {
      const list = await this.source.loadConductFlags(this.patientId());

      if (token === this.token) {
        this.flags.set(list);
      }
    } catch {
      if (token === this.token) {
        this.flagsFailed.set(true);
      }
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

  /** Falha ao ler os pesos degrada só o seletor; o resto do Plano segue. */
  private async loadWeights(token: number): Promise<void> {
    try {
      const weights = await this.source.loadCalculatedWeights(this.patientId());

      if (token === this.token) {
        this.weights.set(weights);
      }
    } catch {
      if (token === this.token) {
        this.weightsFailed.set(true);
      }
    }
  }

  /** Independente do resto do Plano: falha do motor degrada para "sem alerta" com aviso discreto. */
  private async loadRisk(token: number): Promise<void> {
    try {
      const risk = await this.riskSource.load(this.patientId());

      if (token === this.token) {
        this.risk.set(risk);
      }
    } catch {
      if (token === this.token) {
        this.riskFailed.set(true);
      }
    }
  }

  /** Reaproveita a leitura da Avaliação (sem recoleta, FR-019); falha degrada só este campo. */
  private async loadDysphagia(token: number): Promise<void> {
    try {
      const latest = await this.assessmentSource.loadLatest(this.patientId());

      if (token === this.token) {
        const value = latest?.values.dysphagia?.trim();

        this.dysphagia.set(value ? value : null);
        this.calorimetry.set(parsePositive(latest?.values.indirectCalorimetry ?? ''));
      }
    } catch {
      if (token === this.token) {
        this.dysphagiaFailed.set(true);
        this.calorimetryFailed.set(true);
      }
    }
  }
}
