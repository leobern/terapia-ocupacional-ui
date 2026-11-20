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
import { NutritionPanelComponent } from '../patients/nutrition-panel/nutrition-panel.component';
import { NutritionValues } from '../patients/nutrition-panel/nutrition-panel.models';
import { NutritionResultsSource } from '../patients/nutrition-panel/nutrition-results-source';
import { HypothesisOrigin, PatientHubProfile } from './patient-hub.models';
import { HypothesisSynthesizer, HypothesisWriter, PatientHubSource } from './patient-hub-source';
import { PriorStaysBoxComponent } from './prior-stays-box/prior-stays-box.component';

type HubStatus = 'loading' | 'ready' | 'not-found' | 'error';

/** Etapa do preenchimento da Hipótese: colar → carregando → revisão (IA) ou falha (manual). */
type FillPhase = 'input' | 'loading' | 'review' | 'failed';

const PULL_THRESHOLD = 80;

/** Voltar a ficar visível recarrega os resultados do painel; oculto não (sem polling nem stream). */
export function reloadsOnVisibility(state: DocumentVisibilityState): boolean {
  return state === 'visible';
}

/** Modo do cartão: leitura, colar novo texto (fluxo da IA) ou edição direta. Sem hipótese, sempre "paste". */
type CardMode = 'view' | 'paste' | 'edit';

const OFFLINE_HINT = 'Conexão necessária para sintetizar ou confirmar a hipótese.';
const DAY_MS = 86_400_000;

/** Hub do paciente (FT-004-2): cabeçalho e cartão "Hipótese diagnóstica" (Figma 4608:4375 / 4608:4845). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    IconButtonComponent,
    NutritionPanelComponent,
    PageContainerComponent,
    PhIconComponent,
    PriorStaysBoxComponent,
    TherapyTagComponent,
  ],
  host: {
    '(window:focus)': 'reloadResults()',
    '(document:visibilitychange)': 'onVisibility()',
    '(touchstart)': 'pullStart($event)',
    '(touchend)': 'pullEnd($event)',
  },
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
  /** Resultados de outras features exibidos no Painel Nutricional; indicador ausente = "Sem dados". */
  protected readonly values = signal<NutritionValues>({});

  protected readonly mode = computed<CardMode>(() =>
    this.hypothesis() === null ? 'paste' : (this.editing() ?? 'view'),
  );

  protected readonly phase = signal<FillPhase>('input');
  /** Texto colado do prontuário (permanece disponível se a síntese falhar). */
  protected readonly pasted = signal('');
  /** Texto em revisão: retorno da IA (editável) ou digitação manual. */
  protected readonly draft = signal('');
  /** Orientação de validação/conexão/gravação exibida ao profissional. */
  protected readonly hint = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly offline = computed(() => !this.connectivity.online());

  protected readonly hospitalId = computed(() => this.context.selected()?.id ?? null);
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

  private readonly editing = signal<'paste' | 'edit' | null>(null);
  private readonly source = inject(PatientHubSource);
  private readonly results = inject(NutritionResultsSource);
  private pullFrom: number | null = null;
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
    void this.reloadResults();
  }

  /** Recarrega os resultados do painel; se falhar (ou offline), mantém os valores já exibidos. */
  async reloadResults(): Promise<void> {
    const id = this.patientId();

    if (id === null) {
      return;
    }
    try {
      this.values.set(await this.results.load(id));
    } catch {
      // mantém os valores atuais
    }
  }

  protected onVisibility(): void {
    if (reloadsOnVisibility(document.visibilityState)) {
      void this.reloadResults();
    }
  }

  /** Puxar-para-atualizar: arrasto vertical de mais de 80px a partir do topo da página. */
  protected pullStart(event: TouchEvent): void {
    this.pullFrom = window.scrollY <= 0 ? event.touches[0].clientY : null;
  }

  protected pullEnd(event: TouchEvent): void {
    const from = this.pullFrom;

    this.pullFrom = null;
    if (from !== null && event.changedTouches[0].clientY - from > PULL_THRESHOLD) {
      void this.reloadResults();
    }
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
      this.resetFlow();
    } catch {
      this.hint.set('Não foi possível gravar a hipótese. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }

  /** Cenário 1 (US2): atualizar colando um novo trecho, mesmo fluxo do preenchimento inicial. */
  protected startPaste(): void {
    this.resetFlow();
    this.editing.set('paste');
  }

  /** Cenário 2 (US2): edição direta do texto atual, sem IA; só grava em "Salvar". */
  protected startEdit(): void {
    this.resetFlow();
    this.draft.set(this.hypothesis() ?? '');
    this.editing.set('edit');
  }

  /** Fecha o fluxo de atualização mantendo a hipótese anterior intacta. */
  protected cancel(): void {
    this.resetFlow();
  }

  /** Descarta a revisão e volta ao texto colado (mantido). */
  protected discard(): void {
    this.phase.set('input');
    this.hint.set(null);
  }

  private resetFlow(): void {
    this.editing.set(null);
    this.phase.set('input');
    this.pasted.set('');
    this.draft.set('');
    this.aiText = '';
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
