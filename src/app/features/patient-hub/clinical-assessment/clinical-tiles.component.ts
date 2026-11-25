import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { IconButtonComponent } from '../../../shared/components/icon-button/icon-button.component';
import { MeasureBadge, MeasureChartComponent, MeasurePoint } from '../charts/measure-chart.component';
import {
  ClinicalAssessment,
  clinicalStatus,
  deviceLabel,
  StatusTone,
  tnLabel,
  withFixedItems,
} from './clinical-assessment.models';
import { ClinicalAssessmentSource } from './clinical-assessment-source';
import { clinicalItemTrend } from './clinical-item-trend';

interface Tile {
  readonly id: string;
  /** Progressão do valor (gráfico ao tocar no card); vazia para tipo de TN, dispositivo e itens sem número. */
  readonly trend: readonly MeasurePoint[];
  readonly label: string;
  readonly value: string;
  readonly unit: string;
  readonly status: { readonly label: string; readonly tone: StatusTone } | null;
}

/**
 * Cards da avaliação clínica no Hub (Figma 4608:4995 — NRS, SARC-F, panturrilha...): tipo de TN, dispositivo e os itens
 * livres cadastrados pelo editor, cada um com valor, unidade e status em texto (ponto de cor + rótulo).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, MeasureChartComponent],
  selector: 'app-clinical-tiles',
  styleUrl: './clinical-tiles.component.scss',
  templateUrl: './clinical-tiles.component.html',
})
export class ClinicalTilesComponent {
  readonly patientId = input.required<string>();
  /** Muda quando o editor salva: a avaliação é lida de novo. */
  readonly refreshKey = input(0);

  protected readonly assessment = signal<ClinicalAssessment | null>(null);
  protected readonly tiles = computed<readonly Tile[]>(() => {
    const a = this.assessment();

    if (a === null) {
      return [];
    }

    return [
      { id: 'tn', label: 'Tipo de TN', status: null, trend: [], unit: tnLabel(a.tnType), value: a.tnType },
      { id: 'device', label: 'Dispositivo', status: null, trend: [], unit: deviceLabel(a.device), value: a.device },
      ...withFixedItems(a.items).map(i => ({
        id: i.id,
        label: i.title,
        status: clinicalStatus(i),
        trend: clinicalItemTrend(this.patientId(), i.id, i.value),
        unit: i.value === '' ? '' : i.unit,
        value: i.value === '' ? 'Sem dados' : i.value,
      })),
    ];
  });

  /** Card aberto (com o gráfico de progressão); um por vez. */
  protected readonly openId = signal<string | null>(null);

  private readonly source = inject(ClinicalAssessmentSource);
  private token = 0;

  constructor() {
    effect(() => {
      const id = this.patientId();

      this.refreshKey();
      untracked(() => void this.load(id));
    });
  }

  protected toggle(tile: Tile): void {
    this.openId.update(current => (current === tile.id || tile.trend.length === 0 ? null : tile.id));
  }

  protected close(): void {
    this.openId.set(null);
  }

  /** Selo de variação da série: do primeiro ao último valor. */
  protected badge(trend: readonly MeasurePoint[]): MeasureBadge {
    const first = trend[0];
    const last = trend[trend.length - 1];
    const delta = Math.round((last.value - first.value) * 10) / 10;

    if (delta === 0) {
      return { icon: 'check', text: `Estável desde ${first.label}` };
    }

    return {
      icon: delta > 0 ? 'arrow-up' : 'arrow-down',
      text: `${delta > 0 ? '+' : ''}${String(delta).replace('.', ',')} desde ${first.label}`,
    };
  }

  protected decimals(trend: readonly MeasurePoint[]): number {
    return trend.every(p => Number.isInteger(p.value)) ? 0 : 1;
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;

    try {
      const a = await this.source.load(patientId);

      if (token === this.token) {
        this.assessment.set(a);
      }
    } catch {
      // mantém o que já está na tela
    }
  }
}
