import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { FIXED_NUTRITION_INDICATORS, NutritionIndicatorId, NutritionValues } from './nutrition-panel.models';

/** Texto de trabalho do estado vazio (FT-004-3, FR-002). */
export const NO_DATA_TEXT = 'Sem dados';

/**
 * Painel Nutricional do Hub (FT-004-3). Sempre renderiza os cards fixos; um card sem valor
 * mostra "Sem dados" (texto, nunca só cor). Tocar em um card emite `cardSelect`; "+" e ocultar são de outras stories.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-nutrition-panel',
  styleUrl: './nutrition-panel.component.scss',
  templateUrl: './nutrition-panel.component.html',
})
export class NutritionPanelComponent {
  readonly values = input<NutritionValues>({});
  /** Toque (ou Enter/Espaço) em um card: o Hub abre o modal de histórico e edição. */
  readonly cardSelect = output<NutritionIndicatorId>();

  protected readonly cards = computed(() =>
    FIXED_NUTRITION_INDICATORS.map(({ id, label }) => ({
      id,
      label,
      value: this.values()[id]?.trim() || NO_DATA_TEXT,
    })),
  );
}
