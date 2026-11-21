import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatNumber } from '../../patient-hub/plan/plan-targets';
import { DailyAdequacy, NutrientAdequacy } from './adequacy.models';

interface Row {
  readonly bar: number;
  readonly intake: string;
  readonly label: string;
  readonly percent: number;
  readonly text: string;
}

const UNAVAILABLE_HINTS = {
  'no-target': 'Indisponível: defina a meta calórica e proteica no Plano de intervenção.',
  offline: 'Indisponível sem conexão.',
} as const;

/**
 * Aporte do dia e % de adequação (Figma 4717-9855, "Aporte calórico/proteico"). Só exibe o resultado
 * já calculado por `DailyAdequacyService` (o mesmo do Painel Nutricional); não calcula nada.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-adequacy-summary',
  styleUrl: './adequacy-summary.component.scss',
  templateUrl: './adequacy-summary.component.html',
})
export class AdequacySummaryComponent {
  readonly adequacy = input.required<DailyAdequacy>();

  protected readonly hint = computed(() => {
    const value = this.adequacy();

    return value.status === 'unavailable' ? UNAVAILABLE_HINTS[value.reason] : null;
  });

  protected readonly rows = computed<readonly Row[]>(() => {
    const value = this.adequacy();

    if (value.status === 'unavailable') {
      return [];
    }

    return [this.row('Aporte calórico', value.calories, 'kcal', 0), this.row('Aporte proteico', value.protein, 'g', 1)];
  });

  private row(label: string, n: NutrientAdequacy, unit: string, digits: number): Row {
    return {
      bar: Math.min(n.percent, 100),
      intake: `${formatNumber(n.intake, 0, digits)} ${unit}`,
      label,
      percent: n.percent,
      text: `${n.percent}% da meta (${formatNumber(n.target, 0, digits)} ${unit})`,
    };
  }
}
