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

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import {
  CurrentRoute,
  normalizeRoutes,
  NUTRITION_ROUTES,
  NutritionRoute,
  routeDiffers,
  routeLabel,
} from '../plan/plan.models';
import { PlanSource } from '../plan/plan-source';

export const ROUTE_OFFLINE_HINT = 'Conexão necessária para alterar a via de nutrição.';
export const ROUTE_LOAD_FAILED_HINT = 'Não foi possível carregar a via vigente.';
export const ROUTE_SAVE_FAILED_HINT = 'Não foi possível salvar a via. A via anterior foi mantida; tente novamente.';
export const ROUTE_EMPTY_HINT = 'Selecione ao menos uma via de nutrição para salvar.';
export const ROUTE_CONFIRM_HINT = 'Alterar a via exige confirmação do médico.';

/**
 * Alterar a via de nutrição na revisão diária (FT-004-8, US-004-8-04; Figma 4718-10198, campo "Via de
 * nutrição"). Reutiliza o mecanismo do Plano de Intervenção (FT-004-6): mesmas opções, normalização,
 * regra de "ao menos uma via" e a mesma porta `PlanSource.saveRoute` (que grava autor e data/hora na trilha
 * de auditoria). Só o médico altera; sem conexão só a via vigente (cache) fica visível.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  selector: 'app-route-change',
  styleUrl: './route-change.component.scss',
  templateUrl: './route-change.component.html',
})
export class RouteChangeComponent {
  readonly patientId = input.required<string>();
  /** Emite a via vigente depois de salva (só quando mudou). */
  readonly routeSaved = output<CurrentRoute>();

  protected readonly options = NUTRITION_ROUTES;
  protected readonly isDoctor = inject(ProfessionalProfileReader).read().role === 'doctor';
  protected readonly online = inject(ConnectivityService).online;
  protected readonly current = signal<CurrentRoute | null>(null);
  protected readonly selection = signal<readonly NutritionRoute[]>([]);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly hint = signal<string | null>(null);
  protected readonly offlineHint = ROUTE_OFFLINE_HINT;
  protected readonly confirmHint = ROUTE_CONFIRM_HINT;
  protected readonly currentLabel = computed(() => {
    const c = this.current();

    return c === null ? 'Sem via definida' : routeLabel(c.routes);
  });

  private readonly source = inject(PlanSource);
  private readonly profile = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  private token = 0;

  constructor() {
    effect(() => {
      const id = this.patientId();

      untracked(() => void this.load(id));
    });
  }

  protected isSelected(id: NutritionRoute): boolean {
    return this.selection().includes(id);
  }

  protected startEditing(): void {
    if (!this.isDoctor) {
      return;
    }
    if (!this.online()) {
      this.hint.set(ROUTE_OFFLINE_HINT);

      return;
    }
    this.selection.set(this.current()?.routes ?? []);
    this.hint.set(null);
    this.editing.set(true);
  }

  protected cancel(): void {
    this.editing.set(false);
    this.hint.set(null);
  }

  protected toggle(id: NutritionRoute): void {
    this.hint.set(null);
    this.selection.update(list => normalizeRoutes(list.includes(id) ? list.filter(r => r !== id) : [...list, id]));
  }

  /** Grava a seleção como nova via vigente; sem mudança não regrava (não renova o "desde quando"). */
  protected async save(): Promise<void> {
    if (!this.isDoctor || this.saving()) {
      return;
    }
    if (!this.online()) {
      this.hint.set(ROUTE_OFFLINE_HINT);

      return;
    }
    if (this.selection().length === 0) {
      this.hint.set(ROUTE_EMPTY_HINT);

      return;
    }
    if (!routeDiffers(this.current(), this.selection())) {
      this.editing.set(false);

      return;
    }
    const token = this.token;

    this.saving.set(true);
    this.hint.set(null);
    try {
      const saved = await this.source.saveRoute({
        at: this.now().toISOString(),
        author: this.profile.read().name,
        patientId: this.patientId(),
        routes: this.selection(),
      });

      if (token === this.token) {
        this.current.set(saved);
        this.editing.set(false);
        this.routeSaved.emit(saved);
      }
    } catch {
      this.hint.set(ROUTE_SAVE_FAILED_HINT);
    } finally {
      this.saving.set(false);
    }
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;

    this.current.set(null);
    this.editing.set(false);
    this.hint.set(null);
    try {
      const route = await this.source.loadRoute(patientId);

      if (token === this.token) {
        this.current.set(route);
      }
    } catch {
      if (token === this.token) {
        this.hint.set(ROUTE_LOAD_FAILED_HINT);
      }
    }
  }
}
