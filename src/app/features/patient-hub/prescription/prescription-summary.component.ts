import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { formatRelativeTime } from '../../../shared/utils/relative-time';
import { formatNumber } from '../plan/plan-targets';
import { modalityLabel, PRESCRIBER_ROLE, Prescription, routeTitle, scheduleText } from './prescription.models';

/**
 * Prescrição vigente em leitura (FT-004-8; Figma 4718-10198, seção "Prescrição ativa"): usada no Hub e na
 * Evolução Diária, onde horários previstos e orientações de enfermagem ficam visíveis (FR-009).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent],
  selector: 'app-prescription-summary',
  styleUrl: './prescription-summary.component.scss',
  templateUrl: './prescription-summary.component.html',
})
export class PrescriptionSummaryComponent {
  /** Uma por via ativa; vazio = sem prescrição. */
  readonly prescriptions = input<readonly Prescription[]>([]);
  readonly title = input('Prescrição ativa');
  /** Mostra quem prescreveu e quando (Figma 4784:32504): o médico e a data da fórmula. */
  readonly showAuthor = input(false);

  protected readonly lines = computed(() => {
    const list = this.prescriptions();

    return list.map(p => ({
      author: p.author,
      authorMeta: `${PRESCRIBER_ROLE} · ${formatRelativeTime(p.at)}`,
      formula: p.formulaName,
      modality: modalityLabel(p.modality),
      notes: p.nursingNotes,
      route: p.route,
      routeTitle: list.length > 1 ? routeTitle(p.route) : null,
      schedule: scheduleText(p),
      volume: `${formatNumber(p.volumeMl)} mL/dia`,
    }));
  });
}
