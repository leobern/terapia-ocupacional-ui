import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { TherapyTagComponent } from '../../shared/components/therapy-tag/therapy-tag.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { NOW } from '../home/professional-profile';
import { PatientHubProfile } from './patient-hub.models';
import { PatientHubSource } from './patient-hub-source';

type HubStatus = 'loading' | 'ready' | 'not-found' | 'error';

const DAY_MS = 86_400_000;

/** Hub do paciente (FT-004-2): cabeçalho e cartão "Hipótese diagnóstica" (Figma 4608:4375 / 4608:4845). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, PageContainerComponent, TherapyTagComponent],
  selector: 'app-patient-hub',
  styleUrl: './patient-hub.component.scss',
  templateUrl: './patient-hub.component.html',
})
export class PatientHubComponent implements OnInit {
  protected readonly connectivity = inject(ConnectivityService);

  protected readonly status = signal<HubStatus>('loading');
  protected readonly profile = signal<PatientHubProfile | null>(null);
  /** Hipótese confirmada; `null` = ainda não preenchida. */
  protected readonly hypothesis = signal<string | null>(null);

  protected readonly hospitalName = computed(() => this.context.selected()?.name ?? '');
  protected readonly todayLabel = computed(() => {
    const label = this.now().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', weekday: 'long' });

    return label.charAt(0).toUpperCase() + label.slice(1);
  });
  protected readonly bedLabel = computed(() => {
    const p = this.profile();

    return p === null ? '' : `${p.ward} · Leito ${p.bed}`;
  });
  protected readonly detailsLabel = computed(() => {
    const p = this.profile();

    if (p === null) {
      return '';
    }
    const [y, m, d] = p.birthDate.split('-');

    return `${this.ageOf(p.birthDate)} anos · ${d}/${m}/${y}`;
  });
  protected readonly therapyDaysLabel = computed(() => {
    const p = this.profile();

    if (p === null) {
      return '';
    }
    const days = Math.max(0, Math.floor((this.now().getTime() - new Date(p.therapyStartDate).getTime()) / DAY_MS));

    if (days === 0) {
      return 'Terapia iniciada hoje';
    }

    return `Terapia há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  });

  private readonly source = inject(PatientHubSource);
  private readonly context = inject(HospitalContextService);
  private readonly location = inject(Location);
  private readonly now = inject(NOW);
  private readonly patientId = toSignal(inject(ActivatedRoute).paramMap.pipe(map(params => params.get('id'))), {
    initialValue: null,
  });

  ngOnInit(): void {
    void this.load();
  }

  protected back(): void {
    this.location.back();
  }

  private async load(): Promise<void> {
    const id = this.patientId();

    if (id === null) {
      this.status.set('not-found');

      return;
    }
    try {
      const [profile, hypothesis] = await Promise.all([this.source.loadProfile(id), this.source.loadHypothesis(id)]);

      this.profile.set(profile);
      this.hypothesis.set(hypothesis);
      this.status.set(profile === null ? 'not-found' : 'ready');
    } catch {
      this.status.set('error');
    }
  }

  private ageOf(birthDate: string): number {
    const today = this.now();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();

    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  }
}
