import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** `neutral` = via de terapia (NE · NP · VO); `success` = destaque positivo (ex.: "Primeira avaliação"). */
export type TherapyTagTone = 'neutral' | 'success';

/**
 * Pílula compacta do Figma `v2/TherapyTag`: 24px de altura, padding lateral 8, Label/Sm.
 * Mesma caixa para todos os usos (via de terapia, "Primeira avaliação"), só a cor muda
 * com `tone`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"therapy-tag therapy-tag--" + tone() + " therapy-tag--" + shape()' },
  selector: 'app-therapy-tag',
  styleUrl: './therapy-tag.component.scss',
  template: '{{ label() }}',
})
export class TherapyTagComponent {
  readonly label = input.required<string>();
  readonly tone = input<TherapyTagTone>('neutral');
  /** `pill` (padrão) ou `box` (raio xs; usado sobre o gauge na linha mobile). */
  readonly shape = input<'pill' | 'box'>('pill');
}
