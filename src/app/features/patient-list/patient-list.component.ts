import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PhIconComponent } from '../../shared/icons/ph-icon/ph-icon.component';
import { HospitalContextService } from '../home/hospital-context.service';
import { PatientCard, TherapyType } from './patient-list.models';
import { assemblePatientList } from './patient-list-assembly';
import { PatientListSource } from './patient-list-source';

export type PatientListStatus = 'loading' | 'ready' | 'error';

const THERAPY_LABEL: Record<TherapyType, string> = { MISTA: 'VO · NE · NP', NE: 'NE', NP: 'NP', VO: 'VO' };

/**
 * Jornada Clínica — lista de pacientes da EMTN do hospital em contexto, na data de hoje
 * (US-004-1-01). Só exibe e navega: não produz dado clínico (FR-038).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, ButtonComponent, PageContainerComponent, PhIconComponent],
  selector: 'app-patient-list',
  styleUrl: './patient-list.component.scss',
  templateUrl: './patient-list.component.html',
})
export class PatientListComponent {
  readonly status = signal<PatientListStatus>('loading');
  readonly patients = signal<readonly PatientCard[]>([]);
  readonly hospitalName = computed(() => this.context.selected()?.name ?? '');
  readonly countLabel = computed(() => {
    const n = this.patients().length;

    return `${n} ${n === 1 ? 'paciente' : 'pacientes'}`;
  });

  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  private readonly context = inject(HospitalContextService);
  private readonly source = inject(PatientListSource);
  private readonly router = inject(Router);
  private generation = 0;

  constructor() {
    effect(() => {
      const hospitalId = this.context.selected()?.id;

      if (hospitalId !== undefined) {
        void this.load(hospitalId);
      }
    });
  }

  async load(hospitalId: string): Promise<void> {
    const generation = ++this.generation;
    const day = new Date();

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

  openPatient(id: string): void {
    void this.router.navigate(['/patients', id]);
  }

  back(): void {
    void this.router.navigate(['/home']);
  }

  protected therapyLabel(therapy: TherapyType): string {
    return THERAPY_LABEL[therapy];
  }
}
