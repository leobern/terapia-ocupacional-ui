import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

import { IconButtonComponent } from '../../../shared/components/icon-button/icon-button.component';
import { IconLogoComponent } from '../../../shared/components/icon-logo/icon-logo.component';
import { NutritionIndicatorId, nutritionIndicatorLabel } from './nutrition-panel.models';

export const OFFLINE_SHOW_HINT = 'Conexão necessária para reexibir um card.';
export const SHOW_FAILED_HINT = 'Não foi possível reexibir o card. Tente novamente.';

/**
 * Lista dos cards ocultos do Painel Nutricional (FT-004-3, US6, FR-021; desenhada pelo agente, mesmo
 * chassi da listagem do "+"). Escolher um card o devolve à grid; só então ele pode ser aberto e editado.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconLogoComponent, IconButtonComponent],
  selector: 'app-nutrition-hidden-cards-sheet',
  styleUrl: './nutrition-add-card-sheet.component.scss',
  templateUrl: './nutrition-hidden-cards-sheet.component.html',
})
export class NutritionHiddenCardsSheetComponent {
  readonly open = input(false);
  readonly hidden = input<readonly NutritionIndicatorId[]>([]);
  readonly offline = input(false);
  readonly error = input<string | null>(null);

  readonly closed = output();
  readonly picked = output<NutritionIndicatorId>();

  protected readonly items = computed(() => this.hidden().map(id => ({ id, label: nutritionIndicatorLabel(id) })));
  protected readonly offlineText = OFFLINE_SHOW_HINT;

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    effect(() => {
      const element = this.dialogRef()?.nativeElement;

      if (this.open() && element && !element.open) {
        element.showModal();
      } else if (!this.open() && element?.open) {
        element.close();
      }
    });
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
}
