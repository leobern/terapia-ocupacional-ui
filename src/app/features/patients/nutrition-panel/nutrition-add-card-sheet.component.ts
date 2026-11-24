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
import { CatalogNutritionIndicatorId, NUTRITION_CARD_CATALOG } from './nutrition-panel.models';

export const OFFLINE_ADD_HINT = 'Conexão necessária para adicionar um card.';
export const ADD_FAILED_HINT = 'Não foi possível adicionar o card. Tente novamente.';
export const NO_CARDS_AVAILABLE_TEXT = 'Todos os cards disponíveis já foram adicionados.';

/**
 * Listagem do "+" do Painel Nutricional (FT-004-3, US5; variação "+" de DS-screen-painel-nutricional,
 * desenhada pelo agente). Mesmo chassi do modal do card: bottom-sheet no mobile, diálogo no desktop.
 * Lista só os tipos do catálogo que ainda não estão no painel.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconLogoComponent, IconButtonComponent],
  selector: 'app-nutrition-add-card-sheet',
  styleUrl: './nutrition-add-card-sheet.component.scss',
  templateUrl: './nutrition-add-card-sheet.component.html',
})
export class NutritionAddCardSheetComponent {
  readonly open = input(false);
  /** Tipos já presentes no painel (não aparecem na listagem). */
  readonly present = input<readonly string[]>([]);
  readonly offline = input(false);
  readonly error = input<string | null>(null);

  readonly closed = output();
  readonly picked = output<CatalogNutritionIndicatorId>();

  protected readonly available = computed(() => NUTRITION_CARD_CATALOG.filter(c => !this.present().includes(c.id)));
  protected readonly emptyText = NO_CARDS_AVAILABLE_TEXT;
  protected readonly offlineText = OFFLINE_ADD_HINT;

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
