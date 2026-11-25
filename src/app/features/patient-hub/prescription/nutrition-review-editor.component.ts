import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { IconButtonComponent } from '../../../shared/components/icon-button/icon-button.component';
import {
  AssistantEditorController,
  type EditorAction,
} from '../../../shared/services/assistant-editor-controller.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { dayKey, registeredAt } from '../daily-record/daily-record.models';
import { CurrentRoute, normalizeRoutes, NUTRITION_ROUTES, NutritionRoute, routeDiffers } from '../plan/plan.models';
import { PlanSource } from '../plan/plan-source';
import { formatNumber, NutritionTargets } from '../plan/plan-targets';
import { TargetsEditorComponent } from '../plan/targets-editor.component';
import { Prescription, PrescriptionReview } from './prescription.models';
import { PrescriptionSource } from './prescription-source';
import { PrescriptionSummaryComponent } from './prescription-summary.component';

export const NR_OFFLINE_HINT = 'Conexão necessária para alterar a meta, a via ou manter a prescrição.';
export const NR_LOAD_FAILED_HINT = 'Não foi possível carregar os dados agora. Tente novamente em instantes.';
export const NR_TARGETS_SAVE_FAILED_HINT =
  'Não foi possível salvar a meta. A meta anterior foi mantida; tente novamente.';
export const NR_TARGETS_NOTHING_HINT = 'Nada a salvar: altere o peso de referência ou os fatores da meta.';
export const NR_ROUTE_EMPTY_HINT = 'Selecione ao menos uma via de nutrição para salvar.';
export const NR_ROUTE_SAVE_FAILED_HINT = 'Não foi possível salvar a via. A via anterior foi mantida; tente novamente.';
export const NR_KEEP_FAILED_HINT = 'Não foi possível registrar a revisão. Nada foi alterado; tente novamente.';
export const NR_NO_TARGETS_TEXT = 'Meta indisponível: defina a meta calórica e proteica.';

/**
 * Meta nutricional no painel lateral conversacional (Thiago, 2026-11-25): começa pela meta vigente (com "Ajustar meta"),
 * depois a via de nutrição (seleção múltipla) e a prescrição ativa, com o CTA "Manter prescrição ativa". Em cada card de
 * edição, ✓ salva e X cancela (os mesmos botões da avaliação clínica). Exclusivo do médico.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent, PrescriptionSummaryComponent, TargetsEditorComponent],
  selector: 'app-nutrition-review-editor',
  styleUrl: './nutrition-review-editor.component.scss',
  templateUrl: './nutrition-review-editor.component.html',
})
export class NutritionReviewEditorComponent {
  readonly patientId = input.required<string>();
  /** Chamado depois de gravar a meta (o Hub recalcula a adequação). */
  readonly targetsSaved = input<() => void>(() => undefined);
  /** Chamado depois de gravar a via. */
  readonly routeSaved = input<() => void>(() => undefined);

  protected readonly options = NUTRITION_ROUTES;
  protected readonly online = inject(ConnectivityService).online;
  protected readonly targets = signal<NutritionTargets | null>(null);
  protected readonly prescriptions = signal<readonly Prescription[]>([]);
  protected readonly route = signal<CurrentRoute | null>(null);
  protected readonly review = signal<PrescriptionReview | null>(null);
  protected readonly selection = signal<readonly NutritionRoute[]>([]);
  protected readonly routeOpen = signal(false);
  protected readonly adjusting = signal(false);
  protected readonly busy = signal(false);
  protected readonly hint = signal<string | null>(null);
  protected readonly offlineHint = NR_OFFLINE_HINT;
  protected readonly noTargetsText = NR_NO_TARGETS_TEXT;
  protected readonly formatNumber = formatNumber;
  protected readonly routeDirty = computed(() => routeDiffers(this.route(), this.selection()));
  protected readonly selectionText = computed(() =>
    this.selection().length === 0
      ? 'Selecione a via de nutrição'
      : this.options
          .filter(o => this.selection().includes(o.id))
          .map(o => `${o.id} · ${o.label}`)
          .join(', '),
  );
  protected readonly reviewedText = computed(() => {
    const r = this.review();

    return r === null ? '' : `Revisada hoje por ${r.author} · ${registeredAt(r.at)}`;
  });
  protected readonly canKeep = computed(() => !this.busy() && this.online() && this.review() === null);

  private readonly targetsEditor = viewChild(TargetsEditorComponent);
  private readonly editor = inject(AssistantEditorController);
  private readonly plan = inject(PlanSource);
  private readonly prescriptionSource = inject(PrescriptionSource);
  private readonly profile = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  private loaded = false;

  constructor() {
    effect(() => {
      const id = this.patientId();

      if (!this.loaded) {
        this.loaded = true;
        void this.load(id);
      }
    });
    effect(onCleanup => {
      const actions = computed<readonly EditorAction[]>(() => [
        ...(this.adjusting() ? [] : [{ id: 'targets', label: 'Ajustar meta' }]),
        { id: 'route', label: 'Alterar via de nutrição' },
        ...(this.review() === null ? [{ id: 'keep', label: 'Manter prescrição ativa' }] : []),
      ]);

      onCleanup(
        this.editor.attach({
          actions,
          placeholder: 'Escreva a sua mensagem',
          run: (action): void => {
            if (action === 'targets') {
              this.startTargets();
            } else if (action === 'route') {
              this.routeOpen.set(true);
            } else {
              void this.keep();
            }
          },
        }),
      );
    });
  }

  protected isSelected(id: NutritionRoute): boolean {
    return this.selection().includes(id);
  }

  protected toggleRoute(id: NutritionRoute): void {
    this.hint.set(null);
    this.selection.update(list => normalizeRoutes(list.includes(id) ? list.filter(r => r !== id) : [...list, id]));
  }

  protected cancelRoute(): void {
    this.selection.set(this.route()?.routes ?? []);
    this.routeOpen.set(false);
    this.hint.set(null);
  }

  /** Grava a seleção como nova via vigente; sem mudança não regrava (não renova o "desde quando"). */
  protected async saveRoute(): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (!this.online()) {
      this.hint.set(NR_OFFLINE_HINT);

      return;
    }
    if (this.selection().length === 0) {
      this.hint.set(NR_ROUTE_EMPTY_HINT);

      return;
    }
    this.busy.set(true);
    try {
      const saved = await this.plan.saveRoute({
        at: this.now().toISOString(),
        author: this.profile.read().name,
        patientId: this.patientId(),
        routes: this.selection(),
      });

      this.route.set(saved);
      this.routeOpen.set(false);
      this.routeSaved()();
    } catch {
      this.hint.set(NR_ROUTE_SAVE_FAILED_HINT);
    } finally {
      this.busy.set(false);
    }
  }

  protected startTargets(): void {
    if (this.online()) {
      this.hint.set(null);
      this.adjusting.set(true);
    } else {
      this.hint.set(NR_OFFLINE_HINT);
    }
  }

  protected cancelTargets(): void {
    this.adjusting.set(false);
    this.hint.set(null);
  }

  /** Grava a meta pelo mesmo mecanismo do Plano de Intervenção (autor e data/hora na trilha da FT-004-6). */
  protected async saveTargets(): Promise<void> {
    const editor = this.targetsEditor();

    if (editor === undefined || this.busy()) {
      return;
    }
    if (!this.online()) {
      this.hint.set(NR_OFFLINE_HINT);

      return;
    }
    const pending = editor.pending();

    if (pending.error !== null) {
      this.hint.set(pending.error);

      return;
    }
    if (pending.reference === null && pending.targets === null) {
      this.hint.set(NR_TARGETS_NOTHING_HINT);

      return;
    }
    this.busy.set(true);
    this.hint.set(null);
    try {
      await editor.commit(
        { at: this.now().toISOString(), author: this.profile.read().name, patientId: this.patientId() },
        pending,
      );
      this.adjusting.set(false);
      this.targets.set(await this.plan.loadTargets(this.patientId()));
      this.targetsSaved()();
    } catch {
      this.hint.set(NR_TARGETS_SAVE_FAILED_HINT);
    } finally {
      this.busy.set(false);
    }
  }

  /** "Manter prescrição ativa": só registra a revisão do dia; a prescrição não é tocada. */
  protected async keep(): Promise<void> {
    if (!this.canKeep()) {
      return;
    }
    const at = this.now();

    this.busy.set(true);
    this.hint.set(null);
    try {
      this.review.set(
        await this.prescriptionSource.keep({
          at: at.toISOString(),
          author: this.profile.read().name,
          day: dayKey(at),
          patientId: this.patientId(),
        }),
      );
    } catch {
      this.hint.set(NR_KEEP_FAILED_HINT);
    } finally {
      this.busy.set(false);
    }
  }

  private async load(patientId: string): Promise<void> {
    try {
      const [targets, route, prescriptions, review] = await Promise.all([
        this.plan.loadTargets(patientId),
        this.plan.loadRoute(patientId),
        this.prescriptionSource.load(patientId),
        this.prescriptionSource.loadReview(patientId, dayKey(this.now())),
      ]);

      this.targets.set(targets);
      this.route.set(route);
      this.selection.set(route?.routes ?? []);
      this.prescriptions.set(prescriptions);
      this.review.set(review);
    } catch {
      this.hint.set(NR_LOAD_FAILED_HINT);
    }
  }
}
