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
import { CurrentRoute, normalizeRoutes, NUTRITION_ROUTES, NutritionRoute, routeLabel } from './plan.models';
import { PlanSource } from './plan-source';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export const LOAD_FAILED_HINT = 'Não foi possível carregar a via vigente. Tente novamente em instantes.';
export const SAVE_FAILED_HINT = 'Não foi possível salvar o plano. A seleção foi mantida; tente novamente.';
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
  protected readonly selection = signal<readonly NutritionRoute[]>([]);
  protected readonly state = signal<LoadState>('idle');
  protected readonly saving = signal(false);
  protected readonly hint = signal<string | null>(null);
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
    if (this.selection().length === 0) {
      this.hint.set(EMPTY_SELECTION_HINT);

      return;
    }
    this.saving.set(true);
    this.hint.set(null);
    try {
      const saved = await this.source.saveRoute({
        at: this.now().toISOString(),
        author: this.profile.read().name,
        patientId: this.patientId(),
        routes: this.selection(),
      });

      this.current.set(saved);
      this.selection.set(saved.routes);
    } catch {
      this.hint.set(SAVE_FAILED_HINT);
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    const token = ++this.token;

    this.current.set(null);
    this.selection.set([]);
    this.hint.set(null);
    this.state.set('loading');
    try {
      const latest = await this.source.loadRoute(this.patientId());

      if (token === this.token) {
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
}
