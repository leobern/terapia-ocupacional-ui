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
import { RefeedingRisk, RefeedingRiskSource } from './refeeding-risk-source';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export const LOAD_FAILED_HINT = 'Não foi possível carregar a via vigente. Tente novamente em instantes.';
export const SAVE_FAILED_HINT = 'Não foi possível salvar o plano. A seleção foi mantida; tente novamente.';
export const RISK_FAILED_HINT = 'Não foi possível verificar o risco de síndrome de realimentação agora.';
export const DYSPHAGIA_FAILED_HINT = 'Não foi possível ler o risco de disfagia da Avaliação agora.';
export const DYSPHAGIA_MISSING_HINT = 'Risco de disfagia ainda não registrado na Avaliação nutricional.';
export const OFFLINE_HINT = 'Sem conexão: não é possível salvar o plano agora.';
export const EMPTY_SELECTION_HINT = 'Selecione ao menos uma via de nutrição para salvar.';

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

    if (this.selection().length === 0 && !swallowingChanged) {
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
    } catch {
      this.hint.set(SAVE_FAILED_HINT);
    } finally {
      this.saving.set(false);
    }
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
    this.state.set('loading');
    void this.loadRisk(token);
    void this.loadDysphagia(token);
    try {
      const [latest, decision] = await Promise.all([
        this.source.loadRoute(this.patientId()),
        this.source.loadSwallowing(this.patientId()),
      ]);

      if (token === this.token) {
        this.savedSwallowing.set(decision);
        this.swallowing.set(decision);
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
