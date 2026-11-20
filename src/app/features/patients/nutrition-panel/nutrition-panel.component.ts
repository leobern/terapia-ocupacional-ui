import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IconButtonComponent } from '../../../shared/components/icon-button/icon-button.component';
import {
  CatalogNutritionIndicatorId,
  FIXED_NUTRITION_INDICATORS,
  NUTRITION_CARD_CATALOG,
  NutritionIndicatorId,
  NutritionValues,
} from './nutrition-panel.models';

/** Texto de trabalho do estado vazio (FT-004-3, FR-002). */
export const NO_DATA_TEXT = 'Sem dados';

/**
 * Painel Nutricional do Hub (FT-004-3). Sempre renderiza os cards fixos; um card sem valor
 * mostra "Sem dados" (texto, nunca só cor). Tocar em um card emite `cardSelect`; o "+" emite `addRequest`; cards ocultos não são listados.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent],
  selector: 'app-nutrition-panel',
  styleUrl: './nutrition-panel.component.scss',
  templateUrl: './nutrition-panel.component.html',
})
export class NutritionPanelComponent {
  readonly values = input<NutritionValues>({});
  /** Cards adicionados pelo "+", exibidos após os fixos. */
  readonly addedCards = input<readonly CatalogNutritionIndicatorId[]>([]);
  /** Cards ocultos da grid (US6); seguem existindo por baixo. */
  readonly hiddenCards = input<readonly NutritionIndicatorId[]>([]);
  /** Toque no "+" do título: o Hub abre a listagem de cards disponíveis. */
  readonly addRequest = output();
  /** Toque (ou Enter/Espaço) em um card: o Hub abre o modal de histórico e edição. */
  /** Toque em "Cards ocultos": o Hub abre a lista para reexibir. */
  readonly hiddenRequest = output();
  readonly cardSelect = output<NutritionIndicatorId>();

  protected readonly cards = computed(() =>
    [...FIXED_NUTRITION_INDICATORS, ...NUTRITION_CARD_CATALOG.filter(c => this.addedCards().includes(c.id))]
      .filter(({ id }) => !this.hiddenCards().includes(id))
      .map(({ id, label }) => ({
        id: id as NutritionIndicatorId,
        label,
        value: this.values()[id as NutritionIndicatorId]?.trim() || NO_DATA_TEXT,
      })),
  );
}
