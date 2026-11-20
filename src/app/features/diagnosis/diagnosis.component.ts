import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { PatientHubProfile } from '../patient-hub/patient-hub.models';
import { PatientHubSource } from '../patient-hub/patient-hub-source';
import {
  GLIM_CRITERIA,
  GLIM_STATE_LABELS,
  GlimCriterionDefinition,
  GlimCriterionState,
  GlimDiagnosis,
  GlimOutcome,
  GlimSeverity,
} from './diagnosis.models';
import { DiagnosisSource } from './diagnosis-source';
import { evaluateGlim } from './glim-engine';

type LoadStatus = 'loading' | 'ready' | 'error';

export const OFFLINE_HINT = 'Sem conexão: o cálculo inicial do diagnóstico precisa de conexão.';
export const ERROR_HINT = 'Não foi possível ler os dados da avaliação. Tente novamente em instantes.';

const OUTCOME_TITLES: Readonly<Record<GlimOutcome, string>> = {
  confirmed: 'Desnutrição confirmada',
  excluded: 'Desnutrição excluída',
  indeterminate: 'Indeterminado',
  'no-screening': 'Pré-requisito não cumprido',
};

const OUTCOME_DETAILS: Readonly<Record<Exclude<GlimOutcome, 'confirmed'>, string>> = {
  excluded: 'Os 5 critérios foram avaliados e nenhum é positivo.',
  indeterminate: 'Há critérios não avaliados e nenhum positivo. Faltam dados da avaliação para fechar o cálculo.',
  'no-screening': 'Não há triagem positiva registrada para este paciente, por isso o diagnóstico não é calculado.',
};

const STAGING_LABELS: Readonly<Record<GlimSeverity, string>> = { moderate: 'moderada', severe: 'grave' };

interface CriterionRow {
  readonly definition: GlimCriterionDefinition;
  readonly state: GlimCriterionState;
  readonly stateLabel: string;
}

/** Tela de Diagnóstico GLIM do paciente (FT-004-5, US-004-5-01; Figma 4685-9425, desenhado pelo agente). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, PageContainerComponent, SkeletonComponent],
  selector: 'app-diagnosis',
  styleUrl: './diagnosis.component.scss',
  templateUrl: './diagnosis.component.html',
})
export class DiagnosisComponent implements OnInit {
  protected readonly status = signal<LoadStatus>('loading');
  protected readonly profile = signal<PatientHubProfile | null>(null);
  protected readonly diagnosis = signal<GlimDiagnosis | null>(null);
  protected readonly rows = signal<readonly CriterionRow[]>([]);
  protected readonly errorHint = computed(() => (this.connectivity.online() ? ERROR_HINT : OFFLINE_HINT));

  protected readonly subtitle = computed(() => {
    const p = this.profile();

    return p === null ? '' : `${p.name} · ${p.ward} · Leito ${p.bed}`;
  });
  protected readonly title = computed(() => OUTCOME_TITLES[this.diagnosis()?.outcome ?? 'no-screening']);
  protected readonly detail = computed(() => {
    const d = this.diagnosis();

    if (d === null || d.outcome === 'confirmed') {
      return d?.staging
        ? `Estadiamento: ${STAGING_LABELS[d.staging]}.`
        : 'Estadiamento não calculado: faltam dados de perda de peso e IMC.';
    }

    return OUTCOME_DETAILS[d.outcome];
  });
  protected readonly calculated = computed(() => this.diagnosis()?.outcome !== 'no-screening');
  protected readonly phenotypic = computed(() => this.rows().filter(r => r.definition.group === 'phenotypic'));
  protected readonly etiologic = computed(() => this.rows().filter(r => r.definition.group === 'etiologic'));

  private readonly connectivity = inject(ConnectivityService);
  private readonly source = inject(DiagnosisSource);
  private readonly hub = inject(PatientHubSource);
  private readonly location = inject(Location);
  private readonly patientId = toSignal(inject(ActivatedRoute).paramMap.pipe(map(params => params.get('id'))), {
    initialValue: null,
  });

  ngOnInit(): void {
    void this.load();
  }

  protected back(): void {
    this.location.back();
  }

  protected async load(): Promise<void> {
    const id = this.patientId();

    if (id === null) {
      this.status.set('error');

      return;
    }
    this.status.set('loading');
    try {
      const [reading, profile] = await Promise.all([this.source.load(id), this.hub.loadProfile(id)]);

      this.profile.set(profile);
      this.diagnosis.set(evaluateGlim(reading));
      this.rows.set(
        GLIM_CRITERIA.map(definition => ({
          definition,
          state: reading.criteria[definition.id],
          stateLabel: GLIM_STATE_LABELS[reading.criteria[definition.id]],
        })),
      );
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }
}
