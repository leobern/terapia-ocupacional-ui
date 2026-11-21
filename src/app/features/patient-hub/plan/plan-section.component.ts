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
  routeDiffers,
  routeLabel,
  SWALLOWING_OPTIONS,
  SwallowingDecision,
  swallowingLabel,
} from './plan.models';
import { PlanSource } from './plan-source';
import { RefeedingRisk, RefeedingRiskSource } from './refeeding-risk-source';
import {
  cadenceLabel,
  DAILY_CADENCE,
  isDailyCadence,
  normalizeCadence,
  ReviewCadence,
  Weekday,
  WEEKDAYS,
} from './review-cadence';
import { PendingTargets, TargetsEditorComponent } from './targets-editor.component';

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
export {
  CALORIMETRY_FAILED_HINT,
  INVALID_FACTOR_HINT,
  INVALID_PERCENT_HINT,
  NO_REFERENCE_HINT,
  WEIGHTS_FAILED_HINT,
  WEIGHTS_MISSING_HINT,
} from './targets-editor.component';
export const RESPONSIBLE_OPTIONS_FAILED_HINT =
  'Não foi possível carregar a lista de médicos. O responsável atual foi mantido.';
export const EMPTY_CADENCE_HINT = 'Marque ao menos um dia da semana para a revisão ou escolha a cadência diária.';
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
  imports: [ButtonComponent, IconButtonComponent, PhIconComponent, TargetsEditorComponent],
  selector: 'app-plan-section',
  styleUrl: './plan-section.component.scss',
  templateUrl: './plan-section.component.html',
})
export class PlanSectionComponent {
  readonly patientId = input.required<string>();
  /** Metas gravadas: o Hub recalcula a % de adequação (cálculo único). */
  readonly targetsSaved = output();

  protected readonly options = NUTRITION_ROUTES;
  protected readonly current = signal<CurrentRoute | null>(null);
  protected readonly swallowingOptions = SWALLOWING_OPTIONS;
  /** Decisão salva e a escolha em edição (a escolha só vira salva em "Salvar plano"). */
  protected readonly savedSwallowing = signal<SwallowingDecision | null>(null);
  protected readonly swallowing = signal<SwallowingDecision | null>(null);
  protected readonly swallowingText = computed(
    () => swallowingLabel(this.savedSwallowing()) || 'Sem decisão registrada',
  );
  protected readonly weekdays = WEEKDAYS;
  /** Cadência salva (padrão diária) e a escolha em edição (só vira salva em "Salvar plano"). */
  protected readonly savedCadence = signal<ReviewCadence>(DAILY_CADENCE);
  protected readonly cadenceMode = signal<'daily' | 'weekdays'>('daily');
  protected readonly pickedDays = signal<readonly Weekday[]>([]);
  protected readonly cadenceText = computed(() => cadenceLabel(this.savedCadence()));
  /** Responsável salvo e a escolha explícita em edição (`null` = não mexeu). */
  protected readonly savedResponsible = signal<string | null>(null);
  protected readonly pickedResponsible = signal<string | null>(null);
  protected readonly responsibleOptionList = signal<readonly string[]>([]);
  protected readonly responsibleOptionsFailed = signal(false);
  protected readonly responsibleOptionsFailedHint = RESPONSIBLE_OPTIONS_FAILED_HINT;
  /** Exibido ao médico: escolha > salvo > ele mesmo (responsável inicial). */
  protected readonly responsibleShown = computed(
    () => this.pickedResponsible() ?? this.savedResponsible() ?? this.profile.read().name,
  );
  protected readonly responsibleChoices = computed(() => {
    const shown = this.responsibleShown();
    const list = this.responsibleOptionList();

    return list.includes(shown) ? list : [shown, ...list];
  });
  protected readonly responsibleText = computed(() => this.savedResponsible() ?? 'Sem responsável definido');
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

  private readonly source = inject(PlanSource);
  private readonly assessmentSource = inject(AssessmentSource);
  private readonly riskSource = inject(RefeedingRiskSource);
  private readonly profile = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  private readonly isOpen = signal(false);
  /** Descarta respostas de uma abertura anterior (fechar e reabrir rápido, ou troca de paciente). */
  private token = 0;
  private readonly targetsEditor = viewChild(TargetsEditorComponent);
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

  protected chooseResponsible(name: string): void {
    if (!this.isDoctor || !this.connectivity.online()) {
      return;
    }
    this.hint.set(null);
    this.pickedResponsible.set(name);
  }

  protected chooseCadenceMode(mode: 'daily' | 'weekdays'): void {
    if (!this.isDoctor || !this.connectivity.online()) {
      return;
    }
    this.hint.set(null);
    this.cadenceMode.set(mode);
  }

  protected toggleDay(id: Weekday): void {
    if (!this.isDoctor || !this.connectivity.online()) {
      return;
    }
    this.hint.set(null);
    this.pickedDays.update(list => normalizeCadence(list.includes(id) ? list.filter(d => d !== id) : [...list, id]));
  }

  protected isDayPicked(id: Weekday): boolean {
    return this.pickedDays().includes(id);
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
    const editor = this.targetsEditor();
    const { error, reference, targets }: PendingTargets = editor?.pending() ?? {
      error: null,
      reference: null,
      targets: null,
    };

    if (error !== null) {
      this.hint.set(error);

      return;
    }
    const days = this.cadenceMode() === 'daily' ? DAILY_CADENCE : normalizeCadence(this.pickedDays());

    if (days.length === 0) {
      this.hint.set(EMPTY_CADENCE_HINT);

      return;
    }
    const cadenceChanged = days.join() !== normalizeCadence(this.savedCadence()).join();
    const explicit = this.pickedResponsible();
    const explicitResponsible = explicit !== null && explicit !== this.savedResponsible();

    if (
      this.selection().length === 0 &&
      !swallowingChanged &&
      reference === null &&
      targets === null &&
      !cadenceChanged &&
      !explicitResponsible
    ) {
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
      await editor?.commit({ at, author, patientId }, { error, reference, targets });
      await this.saveSchedule({ at, author, patientId }, cadenceChanged ? days : null);
    } catch {
      this.hint.set(SAVE_FAILED_HINT);
    } finally {
      this.saving.set(false);
    }
  }

  /** Grava cadência e responsável (nesta ordem); `days` é `null` quando a cadência não mudou. */
  private async saveSchedule(
    meta: { at: string; author: string; patientId: string },
    days: ReviewCadence | null,
  ): Promise<void> {
    const { at, author, patientId } = meta;

    if (days !== null) {
      this.applyCadence(await this.source.saveCadence({ at, author, days, patientId }));
    }
    // Sem responsável salvo, quem define o plano passa a ser o responsável inicial.
    const name = this.pickedResponsible() ?? (this.savedResponsible() === null ? author : null);

    if (name !== null && name !== this.savedResponsible()) {
      this.savedResponsible.set(await this.source.saveResponsible({ at, author, name, patientId }));
      this.pickedResponsible.set(null);
    }
  }

  private applyCadence(days: ReviewCadence): void {
    this.savedCadence.set(days);
    this.cadenceMode.set(isDailyCadence(days) ? 'daily' : 'weekdays');
    this.pickedDays.set(isDailyCadence(days) ? [] : days);
  }

  /** Só regrava a via quando mudou (salvar a decisão sozinha não renova "desde quando" da via). */
  private routeDiffers(): boolean {
    return routeDiffers(this.current(), this.selection());
  }

  private async load(): Promise<void> {
    const token = ++this.token;

    this.current.set(null);
    this.selection.set([]);
    this.savedSwallowing.set(null);
    this.swallowing.set(null);
    this.applyCadence(DAILY_CADENCE);
    this.savedResponsible.set(null);
    this.pickedResponsible.set(null);
    this.responsibleOptionList.set([]);
    this.responsibleOptionsFailed.set(false);
    this.hint.set(null);
    this.risk.set(null);
    this.riskFailed.set(false);
    this.dysphagia.set(null);
    this.dysphagiaFailed.set(false);
    this.flags.set([]);
    this.flagsFailed.set(false);
    this.flagDraft.set('');
    this.flagHint.set(null);
    this.state.set('loading');
    void this.loadFlags(token);
    void this.loadResponsibleOptions(token);
    void this.loadRisk(token);
    void this.loadDysphagia(token);
    try {
      const [latest, decision, cadence, responsible] = await Promise.all([
        this.source.loadRoute(this.patientId()),
        this.source.loadSwallowing(this.patientId()),
        this.source.loadCadence(this.patientId()),
        this.source.loadResponsible(this.patientId()),
      ]);

      if (token === this.token) {
        this.savedSwallowing.set(decision);
        this.swallowing.set(decision);
        this.applyCadence(cadence ?? DAILY_CADENCE);
        this.savedResponsible.set(responsible);
        this.current.set(latest);
        this.selection.set(latest?.routes ?? []);
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

  /** Lista de médicos: falha degrada só este campo, sem perder a escolha. */
  private async loadResponsibleOptions(token: number): Promise<void> {
    try {
      const list = await this.source.loadResponsibleOptions(this.patientId());

      if (token === this.token) {
        this.responsibleOptionList.set(list);
      }
    } catch {
      if (token === this.token) {
        this.responsibleOptionsFailed.set(true);
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
      }
    } catch {
      if (token === this.token) {
        this.dysphagiaFailed.set(true);
      }
    }
  }
}
