import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { AssessmentFieldId, NutritionFunctionalAssessment } from '../assessment/assessment.models';
import { AssessmentSource } from '../assessment/assessment-source';
import { NUTRITIONAL_FUNCTIONAL_FIELDS } from './nutritional-functional.models';

interface Tile {
  readonly id: AssessmentFieldId;
  readonly label: string;
  readonly value: string;
  readonly unit: string;
}

/**
 * Cards da "Avaliação nutricional e funcional" no Hub: os itens fixos (circunferências, calorimetria, handgrip e risco
 * de disfagia) com o último valor registrado, no mesmo estilo dos cards da Avaliação clínica. Sem dado, "Sem dados".
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-nutritional-functional-tiles',
  styleUrl: '../clinical-assessment/clinical-tiles.component.scss',
  template: `
    <ul class="tiles" aria-label="Itens da avaliação nutricional e funcional">
      @for (tile of tiles(); track tile.id) {
        <li class="tiles__tile" data-testid="nutritional-tile">
          <span class="tiles__label">{{ tile.label }}</span>
          <span class="tiles__value"
            >{{ tile.value }} <small>{{ tile.unit }}</small></span
          >
        </li>
      }
    </ul>
  `,
})
export class NutritionalFunctionalTilesComponent {
  readonly patientId = input.required<string>();
  /** Muda quando o editor salva: a avaliação é lida de novo. */
  readonly refreshKey = input(0);

  protected readonly assessment = signal<NutritionFunctionalAssessment | null>(null);
  protected readonly tiles = computed<readonly Tile[]>(() => {
    const values = this.assessment()?.values ?? {};

    return NUTRITIONAL_FUNCTIONAL_FIELDS.map(field => {
      const value = values[field.id]?.trim() ?? '';
      const side = field.sideId === undefined ? '' : (values[field.sideId] ?? '');
      const unit = [field.unit ?? '', side].filter(part => part !== '').join(' · ');

      return {
        id: field.id,
        label: field.label.split(' (')[0],
        unit: value === '' ? '' : unit,
        value: value === '' ? 'Sem dados' : value,
      };
    });
  });

  private readonly source = inject(AssessmentSource);
  private token = 0;

  constructor() {
    effect(() => {
      const id = this.patientId();

      this.refreshKey();
      untracked(() => void this.load(id));
    });
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;

    try {
      const latest = await this.source.loadLatest(patientId);

      if (token === this.token) {
        this.assessment.set(latest);
      }
    } catch {
      // mantém o que já está na tela
    }
  }
}
