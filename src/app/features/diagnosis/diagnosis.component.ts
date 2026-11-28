import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { formatDateTimeShortYear } from '../../shared/utils/br-date';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import { PatientHubProfile } from '../patient-hub/patient-hub.models';
import { PatientHubSource } from '../patient-hub/patient-hub-source';
import { AlterSheetComponent } from './alter-sheet.component';
import {
  DiagnosisAction,
  DiagnosisDecision,
  DiagnosisRecord,
  GLIM_CRITERIA,
  GLIM_STATE_LABELS,
  GlimCriterionDefinition,
  GlimCriterionState,
  GlimDiagnosis,
  GlimOutcome,
  GlimResult,
  GlimSeverity,
  ProtocolResult,
} from './diagnosis.models';
import { DiagnosisDecisionSource } from './diagnosis-decision-source';
import { DiagnosisSource } from './diagnosis-source';
import { evaluateGlim } from './glim-engine';

type LoadStatus = 'loading' | 'ready' | 'error';

export const OFFLINE_HINT = 'Sem conexão: o cálculo inicial do diagnóstico precisa de conexão.';
export const ACTIONS_OFFLINE_HINT = 'Sem conexão: confirmar, alterar e excluir precisam de conexão.';
export const ACTION_FAILED_HINT = 'Não foi possível gravar a decisão. O diagnóstico continua como estava.';
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

const EMPTY_RECORD: DiagnosisRecord = { audit: [], decision: null, override: null };

const STAGING_LABELS: Readonly<Record<GlimSeverity, string>> = { moderate: 'moderada', severe: 'grave' };

interface CriterionRow {
  readonly definition: GlimCriterionDefinition;
  readonly state: GlimCriterionState;
  readonly stateLabel: string;
}

/** Tela de Diagnóstico GLIM do paciente (FT-004-5, US-004-5-01; Figma 4685-9425, desenhado pelo agente). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    AlterSheetComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    PageContainerComponent,
    SkeletonComponent,
  ],
  selector: 'app-diagnosis',
  styleUrl: './diagnosis.component.scss',
  templateUrl: './diagnosis.component.html',
})
export class DiagnosisComponent implements OnInit {
  protected readonly status = signal<LoadStatus>('loading');
  protected readonly profile = signal<PatientHubProfile | null>(null);
  protected readonly calculated = signal<GlimResult | null>(null);
  protected readonly record = signal<DiagnosisRecord>(EMPTY_RECORD);
  protected readonly acting = signal(false);
  protected readonly actionHint = signal<string | null>(null);
  protected readonly confirmingExclusion = signal(false);
  protected readonly altering = signal(false);
  protected readonly isDoctor = inject(ProfessionalProfileReader).read().role === 'doctor';
  protected readonly connectivityOnline = computed(() => this.connectivity.online());
  protected readonly actionsOfflineHint = ACTIONS_OFFLINE_HINT;
  /** O que vale na tela: decisão gravada, senão o alterado pelo médico, senão o calculado pelo motor. */
  protected readonly shown = computed(
    () => this.record().decision?.result ?? this.record().override ?? this.calculated(),
  );
  protected readonly diagnosis = computed<GlimDiagnosis>(() => {
    const result = this.shown();

    return result === null
      ? { outcome: 'no-screening', staging: null }
      : { outcome: result.outcome, staging: result.staging };
  });
  protected readonly excluded = computed(() => this.record().decision?.status === 'excluded');
  protected readonly confirmed = computed(() => this.record().decision?.status === 'confirmed');
  protected readonly alteredNote = computed(() => {
    const last = this.record().audit.findLast(e => e.action === 'alter');

    return this.record().override === null || last === undefined
      ? ''
      : `Alterado pelo médico: ${last.author} em ${formatDateTimeShortYear(last.at)}.`;
  });
  protected readonly showActions = computed(
    () => this.isDoctor && this.shown() !== null && this.record().decision === null,
  );
  protected readonly fluidRetention = signal(false);
  protected readonly protocols = signal<readonly ProtocolResult[]>([]);
  protected readonly rows = computed<readonly CriterionRow[]>(() => {
    const criteria = this.shown()?.criteria;

    return criteria
      ? GLIM_CRITERIA.map(definition => ({
          definition,
          state: criteria[definition.id],
          stateLabel: GLIM_STATE_LABELS[criteria[definition.id]],
        }))
      : [];
  });
  protected readonly errorHint = computed(() => (this.connectivity.online() ? ERROR_HINT : OFFLINE_HINT));

  protected readonly subtitle = computed(() => {
    const p = this.profile();

    return p === null ? '' : `${p.name} · ${p.ward} · Leito ${p.bed}`;
  });
  protected readonly title = computed(() =>
    this.excluded() ? 'Diagnóstico excluído' : OUTCOME_TITLES[this.diagnosis().outcome],
  );
  protected readonly detail = computed(() => {
    const d = this.diagnosis();

    if (this.excluded()) {
      return 'O resultado calculado deixou de valer como diagnóstico.';
    }
    if (d.outcome === 'confirmed') {
      return d.staging
        ? `Estadiamento: ${STAGING_LABELS[d.staging]}.`
        : 'Estadiamento não calculado: faltam dados de perda de peso e IMC.';
    }

    return OUTCOME_DETAILS[d.outcome];
  });
  /** FR-015: só o resultado Indeterminado (e ainda não excluído) oferece completar os dados faltantes. */
  protected readonly canCompleteData = computed(() => !this.excluded() && this.diagnosis().outcome === 'indeterminate');
  protected readonly hasResult = computed(() => this.diagnosis().outcome !== 'no-screening');
  protected readonly phenotypic = computed(() => this.rows().filter(r => r.definition.group === 'phenotypic'));
  protected readonly etiologic = computed(() => this.rows().filter(r => r.definition.group === 'etiologic'));

  private readonly connectivity = inject(ConnectivityService);
  private readonly source = inject(DiagnosisSource);
  private readonly decisions = inject(DiagnosisDecisionSource);
  private readonly profileReader = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  private readonly hub = inject(PatientHubSource);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly patientId = toSignal(inject(ActivatedRoute).paramMap.pipe(map(params => params.get('id'))), {
    initialValue: null,
  });

  ngOnInit(): void {
    void this.load();
  }

  /**
   * Leva à Avaliação Nutricional e Funcional (que vive no hub do paciente). Ao voltar para esta tela
   * ela é recriada e recalcula a partir dos dados atuais (FR-016).
   */
  protected completeData(): void {
    const id = this.patientId();

    if (id !== null) {
      void this.router.navigate(['/patients', id]);
    }
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
      const [reading, profile, record] = await Promise.all([
        this.source.load(id),
        this.hub.loadProfile(id),
        this.decisions.load(id),
      ]);
      const diagnosis = evaluateGlim(reading);

      this.profile.set(profile);
      this.record.set(record);
      this.calculated.set(
        diagnosis.outcome === 'no-screening'
          ? null
          : { criteria: reading.criteria, outcome: diagnosis.outcome, staging: diagnosis.staging },
      );
      this.fluidRetention.set(reading.fluidRetention);
      this.protocols.set(reading.protocols);
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  protected confirm(): void {
    void this.apply('confirm');
  }

  protected askExclude(): void {
    if (this.canAct()) {
      this.confirmingExclusion.set(true);
    }
  }

  protected cancelExclude(): void {
    this.confirmingExclusion.set(false);
  }

  protected exclude(): void {
    this.confirmingExclusion.set(false);
    void this.apply('exclude');
  }

  protected openAlter(): void {
    if (this.canAct()) {
      this.altering.set(true);
    }
  }

  protected closeAlter(): void {
    this.altering.set(false);
  }

  protected alter(altered: GlimResult): void {
    this.altering.set(false);
    void this.apply('alter', altered);
  }

  protected decisionNote(d: DiagnosisDecision): string {
    return `${d.status === 'confirmed' ? 'Confirmado' : 'Excluído'} por ${d.author} em ${formatDateTimeShortYear(d.at)}.`;
  }

  protected canAct(): boolean {
    return this.showActions() && this.connectivity.online() && !this.acting();
  }

  private async apply(action: DiagnosisAction, altered?: GlimResult): Promise<void> {
    const id = this.patientId();
    const current = this.shown();

    if (id === null || current === null || !this.canAct()) {
      return;
    }
    this.acting.set(true);
    this.actionHint.set(null);
    try {
      this.record.set(
        await this.decisions.apply({
          action,
          altered,
          at: this.now().toISOString(),
          author: this.profileReader.read().name,
          current,
          patientId: id,
        }),
      );
    } catch {
      this.actionHint.set(ACTION_FAILED_HINT);
    } finally {
      this.acting.set(false);
    }
  }
}
