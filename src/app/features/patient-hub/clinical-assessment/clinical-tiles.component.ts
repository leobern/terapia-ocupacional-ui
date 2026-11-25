import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import {
  ClinicalAssessment,
  clinicalStatus,
  deviceLabel,
  StatusTone,
  tnLabel,
  withFixedItems,
} from './clinical-assessment.models';
import { ClinicalAssessmentSource } from './clinical-assessment-source';

interface Tile {
  readonly id: string;
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
      { id: 'tn', label: 'Tipo de TN', status: null, unit: tnLabel(a.tnType), value: a.tnType },
      { id: 'device', label: 'Dispositivo', status: null, unit: deviceLabel(a.device), value: a.device },
      ...withFixedItems(a.items).map(i => ({
        id: i.id,
        label: i.title,
        status: clinicalStatus(i),
        unit: i.value === '' ? '' : i.unit,
        value: i.value === '' ? 'Sem dados' : i.value,
      })),
    ];
  });

  private readonly source = inject(ClinicalAssessmentSource);
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
      const a = await this.source.load(patientId);

      if (token === this.token) {
        this.assessment.set(a);
      }
    } catch {
      // mantém o que já está na tela
    }
  }
}
