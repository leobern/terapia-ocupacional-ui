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
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { NutritionHistorySource, NutritionValueWriter } from './nutrition-card-ports';
import {
  FIXED_NUTRITION_INDICATORS,
  NUTRITION_UNITS,
  NutritionCurrent,
  NutritionHistoryEntry,
  NutritionIndicatorId,
  NutritionValueOrigin,
} from './nutrition-panel.models';

const ORIGIN_LABEL: Record<NutritionValueOrigin, string> = {
  manual: 'informado pela equipe',
  result: 'resultado de outra feature',
};

export const EMPTY_VALUE_HINT = 'Preencha um valor antes de salvar.';
export const OFFLINE_SAVE_HINT = 'Conexão necessária para salvar o valor.';
export const SAVE_FAILED_HINT = 'Não foi possível salvar o valor. Tente novamente.';

/** Formata ISO como dd/MM (internação atual; o ano é omitido como no Figma 4679-8695). */
function shortDate(iso: string): string {
  const d = new Date(iso);

  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Modal do card do Painel Nutricional (FT-004-3, US3; Figma 4679-8695, desenhado pelo agente):
 * valor atual, edição manual e histórico da internação. Bottom-sheet no mobile e diálogo centralizado
 * no desktop (o `app-bottom-sheet` do DS não renderiza no desktop e tem cabeçalho de assistente de IA).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent],
  selector: 'app-nutrition-card-modal',
  styleUrl: './nutrition-card-modal.component.scss',
  templateUrl: './nutrition-card-modal.component.html',
})
export class NutritionCardModalComponent {
  /** Indicador aberto; `null` = modal fechado. */
  readonly indicator = input<NutritionIndicatorId | null>(null);
  readonly patientId = input<string | null>(null);
  readonly current = input<NutritionCurrent | null>(null);

  readonly closed = output();
  readonly saved = output<{ current: NutritionCurrent; indicator: NutritionIndicatorId }>();

  protected readonly connectivity = inject(ConnectivityService);
  protected readonly history = signal<readonly NutritionHistoryEntry[]>([]);
  protected readonly draft = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly offline = computed(() => !this.connectivity.online());

  protected readonly title = computed(
    () => FIXED_NUTRITION_INDICATORS.find(i => i.id === this.indicator())?.label ?? '',
  );
  protected readonly fieldLabel = computed(() => {
    const id = this.indicator();
    const unit = id === null ? undefined : NUTRITION_UNITS[id];

    return unit ? `Novo valor (${unit})` : 'Novo valor';
  });
  protected readonly contextLine = computed(() => {
    const c = this.current();

    if (c === null) {
      return 'Ainda sem valor';
    }
    const date = c.at === null ? '' : `, ${shortDate(c.at)}`;

    return `Valor atual · ${ORIGIN_LABEL[c.origin]}${date}`;
  });
  protected readonly entries = computed(() =>
    this.history().map(e => ({ meta: `${shortDate(e.at)} · ${ORIGIN_LABEL[e.origin]}`, value: e.value })),
  );

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');
  private readonly historySource = inject(NutritionHistorySource);
  private readonly writer = inject(NutritionValueWriter);
  private readonly professional = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);

  constructor() {
    effect(() => {
      const element = this.dialogRef()?.nativeElement;
      const indicator = this.indicator();

      if (indicator !== null && element && !element.open) {
        element.showModal();
        untracked(() => {
          this.draft.set('');
          this.error.set(null);
          void this.loadHistory(indicator);
        });
      } else if (indicator === null && element?.open) {
        element.close();
      }
    });
  }

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
    this.error.set(null);
  }

  protected onDialogClick(event: MouseEvent): void {
    // Clique no ::backdrop chega com o próprio <dialog> como alvo.
    if (event.target instanceof HTMLDialogElement) {
      this.closed.emit();
    }
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }

  protected async save(): Promise<void> {
    const indicator = this.indicator();
    const patientId = this.patientId();
    const value = this.draft().trim();

    if (indicator === null || patientId === null) {
      return;
    }
    if (this.offline()) {
      this.error.set(OFFLINE_SAVE_HINT);

      return;
    }
    if (value === '') {
      this.error.set(EMPTY_VALUE_HINT);

      return;
    }
    const at = this.now().toISOString();

    this.saving.set(true);
    try {
      await this.writer.save({
        at,
        author: this.professional.read().name,
        indicator,
        newOrigin: 'manual',
        patientId,
        previous: this.current(),
        value,
      });
      this.saved.emit({ current: { at, origin: 'manual', value }, indicator });
    } catch {
      this.error.set(SAVE_FAILED_HINT);
    } finally {
      this.saving.set(false);
    }
  }

  private async loadHistory(indicator: NutritionIndicatorId): Promise<void> {
    const patientId = this.patientId();

    this.history.set([]);
    if (patientId === null) {
      return;
    }
    try {
      this.history.set(await this.historySource.load(patientId, indicator));
    } catch {
      // sem histórico disponível: o modal segue utilizável (valor atual e edição)
    }
  }
}
