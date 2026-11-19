import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { DateStripComponent } from '../../shared/components/date-strip/date-strip.component';
import { GraphMetaComponent } from '../../shared/components/graph-meta/graph-meta.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { TherapyTagComponent } from '../../shared/components/therapy-tag/therapy-tag.component';
import { PhIconComponent } from '../../shared/icons/ph-icon/ph-icon.component';
import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { type ScreenAction, ScreenActionsService } from '../../shared/services/screen-actions.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { adequacyLabel, dailyAdequacy, goalLabel, hasAdequacy, therapyStartLabel } from './patient-card-labels';
import { PatientCard, TherapyType } from './patient-list.models';
import { assemblePatientList } from './patient-list-assembly';
import { PatientListSource } from './patient-list-source';

export type PatientListStatus = 'loading' | 'ready' | 'error';

const PATIENT_LIST_ACTIONS: readonly ScreenAction[] = [
  { id: 'register-patient', label: 'Cadastrar paciente' },
  { id: 'edit-patient', label: 'Editar paciente' },
  { id: 'end-follow-up', label: 'Encerrar acompanhamento' },
  { id: 'change-bed', label: 'Alterar leito' },
];

const THERAPY_LABEL: Record<TherapyType, string> = { MISTA: 'VO · NE · NP', NE: 'NE', NP: 'NP', VO: 'VO' };

/**
 * Jornada Clínica — lista de pacientes da EMTN do hospital em contexto, na data de hoje
 * (US-004-1-01). Só exibe e navega: não produz dado clínico (FR-038).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    ButtonComponent,
    DateStripComponent,
    GraphMetaComponent,
    IconButtonComponent,
    PageContainerComponent,
    PhIconComponent,
    TherapyTagComponent,
  ],
  selector: 'app-patient-list',
  styleUrl: './patient-list.component.scss',
  templateUrl: './patient-list.component.html',
})
export class PatientListComponent {
  readonly selectedDate = signal(new Date());
  readonly status = signal<PatientListStatus>('loading');
  readonly patients = signal<readonly PatientCard[]>([]);
  readonly hospitalName = computed(() => this.context.selected()?.name ?? '');
  readonly dayAdequacy = computed(() => dailyAdequacy(this.patients()));
  readonly countLabel = computed(() => {
    const n = this.patients().length;

    return `${n} ${n === 1 ? 'paciente' : 'pacientes'}`;
  });

  protected readonly therapyStartLabel = therapyStartLabel;
  protected readonly adequacyLabel = adequacyLabel;
  protected readonly hasAdequacy = hasAdequacy;
  protected readonly goalLabel = goalLabel;
  protected readonly aiAssistant = inject(AiAssistantService);

  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  private readonly context = inject(HospitalContextService);
  private readonly source = inject(PatientListSource);
  private readonly router = inject(Router);
  private readonly screenActions = inject(ScreenActionsService);
  private generation = 0;

  constructor() {
    // Atalhos da tela (padrão de cadastro): ações principais; os formulários chegam com a US-004-1-07.
    inject(DestroyRef).onDestroy(this.screenActions.register(PATIENT_LIST_ACTIONS));

    effect(() => {
      const hospitalId = this.context.selected()?.id;
      const day = this.selectedDate();

      if (hospitalId !== undefined) {
        void this.load(hospitalId, day);
      }
    });
  }

  async load(hospitalId: string, day: Date = this.selectedDate()): Promise<void> {
    const generation = ++this.generation;

    this.status.set('loading');
    try {
      const census = await this.source.loadCensus(hospitalId, day);

      if (generation === this.generation) {
        this.patients.set(assemblePatientList(census, hospitalId, day));
        this.status.set('ready');
      }
    } catch {
      if (generation === this.generation) {
        this.status.set('error');
      }
    }
  }

  retry(): void {
    const id = this.context.selected()?.id;

    if (id !== undefined) {
      void this.load(id);
    }
  }

  /** Cadastro pertence à FT-002-1: aqui só navega (FR-027). */
  registerPatient(): void {
    void this.router.navigate(['/home']);
  }

  /** Troca a data do carrossel; a lista recarrega via effect. Data retroativa (US3) fica fora desta story. */
  selectDate(day: Date): void {
    this.selectedDate.set(day);
  }

  openPatient(id: string): void {
    void this.router.navigate(['/patients', id]);
  }

  /** Tom da barra de meta: crítico <20, alerta <50, na meta; sem dado não há barra. */
  protected goalTone(value: number | null): 'alert' | 'warning' | 'success' | 'none' {
    if (value === null) {
      return 'none';
    }

    if (value < 20) {
      return 'alert';
    }

    return value < 50 ? 'warning' : 'success';
  }

  protected therapyLabel(therapy: TherapyType): string {
    return THERAPY_LABEL[therapy];
  }
}
