import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { TherapyTagComponent } from '../../shared/components/therapy-tag/therapy-tag.component';
import { PhIconComponent } from '../../shared/icons/ph-icon/ph-icon.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import { HypothesisOrigin, PatientHubProfile } from './patient-hub.models';
import { HypothesisSynthesizer, HypothesisWriter, PatientHubSource } from './patient-hub-source';

type HubStatus = 'loading' | 'ready' | 'not-found' | 'error';

/** Etapa do preenchimento da Hipótese: colar → carregando → revisão (IA) ou falha (manual). */
type FillPhase = 'input' | 'loading' | 'review' | 'failed';

const OFFLINE_HINT = 'Conexão necessária para sintetizar ou confirmar a hipótese.';
const DAY_MS = 86_400_000;

/** Hub do paciente (FT-004-2): cabeçalho e cartão "Hipótese diagnóstica" (Figma 4608:4375 / 4608:4845). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent, PageContainerComponent, PhIconComponent, TherapyTagComponent],
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

  protected readonly phase = signal<FillPhase>('input');
  /** Texto colado do prontuário (permanece disponível se a síntese falhar). */
  protected readonly pasted = signal('');
  /** Texto em revisão: retorno da IA (editável) ou digitação manual. */
  protected readonly draft = signal('');
  /** Orientação de validação/conexão/gravação exibida ao profissional. */
  protected readonly hint = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly offline = computed(() => !this.connectivity.online());

  protected readonly hospitalName = computed(() => this.context.selected()?.name ?? '');
  protected readonly todayLabel = computed(() => {
    const label = this.now().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', weekday: 'long' });

    return label.charAt(0).toUpperCase() + label.slice(1);
  });
  /** Textos do cabeçalho; `null` enquanto o perfil não carregou. */
  protected readonly header = computed(() => {
    const p = this.profile();

    if (p === null) {
      return null;
    }
    const [y, m, d] = p.birthDate.split('-');
    const days = Math.max(0, Math.floor((this.now().getTime() - new Date(p.therapyStartDate).getTime()) / DAY_MS));
    const plural = days === 1 ? 'dia' : 'dias';

    return {
      bed: `${p.ward} · Leito ${p.bed}`,
      details: `${this.ageOf(p.birthDate)} anos · ${d}/${m}/${y}`,
      therapyDays: days === 0 ? 'Terapia iniciada hoje' : `Terapia há ${days} ${plural}`,
    };
  });

  private readonly source = inject(PatientHubSource);
  private readonly context = inject(HospitalContextService);
  private readonly location = inject(Location);
  private readonly now = inject(NOW);
  private readonly synthesizer = inject(HypothesisSynthesizer);
  private readonly writer = inject(HypothesisWriter);
  private readonly professional = inject(ProfessionalProfileReader);
  /** Retorno original da IA, para distinguir "confirmado sem editar" de "editado". */
  private aiText = '';
  private readonly patientId = toSignal(inject(ActivatedRoute).paramMap.pipe(map(params => params.get('id'))), {
    initialValue: null,
  });

  ngOnInit(): void {
    void this.load();
  }

  protected back(): void {
    this.location.back();
  }

  protected onPasted(event: Event): void {
    this.pasted.set((event.target as HTMLTextAreaElement).value);
    this.hint.set(null);
  }

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
    this.hint.set(null);
  }

  /** Cenários 1, 4 e 5: envia o texto colado à IA; vazio não aciona; falha libera o preenchimento manual. */
  protected async synthesize(): Promise<void> {
    if (this.offline()) {
      this.hint.set(OFFLINE_HINT);

      return;
    }
    if (this.pasted().trim() === '') {
      this.hint.set('Cole um texto do prontuário antes de sintetizar.');

      return;
    }
    this.hint.set(null);
    this.phase.set('loading');
    try {
      this.aiText = await this.synthesizer.synthesize(this.pasted());
      this.draft.set(this.aiText);
      this.phase.set('review');
    } catch {
      this.aiText = '';
      this.draft.set('');
      this.phase.set('failed');
    }
  }

  /** Cenário 3: só a confirmação explícita grava; o texto editado (não o original da IA) vira a Hipótese. */
  protected async confirm(): Promise<void> {
    const id = this.patientId();
    const text = this.draft().trim();

    if (this.offline()) {
      this.hint.set(OFFLINE_HINT);

      return;
    }
    if (id === null || text === '') {
      this.hint.set('Escreva a hipótese diagnóstica antes de confirmar.');

      return;
    }
    this.saving.set(true);
    try {
      await this.writer.save({
        at: this.now().toISOString(),
        author: this.professional.read().name,
        origin: this.originOf(text),
        patientId: id,
        text,
      });
      this.hypothesis.set(text);
      this.hint.set(null);
    } catch {
      this.hint.set('Não foi possível gravar a hipótese. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }

  /** Descarta a revisão e volta ao texto colado (mantido). */
  protected discard(): void {
    this.phase.set('input');
    this.hint.set(null);
  }

  private originOf(text: string): HypothesisOrigin {
    if (this.phase() !== 'review') {
      return 'manual';
    }

    return text === this.aiText.trim() ? 'ai' : 'ai-edited';
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
