import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { DateStripComponent } from '../../shared/components/date-strip/date-strip.component';
import { EmptyCardComponent } from '../../shared/components/empty-card/empty-card.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionHeaderComponent } from '../../shared/components/section-header/section-header.component';
import { TherapyTagComponent } from '../../shared/components/therapy-tag/therapy-tag.component';
import { PhIconComponent } from '../../shared/icons/ph-icon/ph-icon.component';
import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { AssistantEditorController } from '../../shared/services/assistant-editor-controller.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { ScreenAction, ScreenActionsService } from '../../shared/services/screen-actions.service';
import { PATIENT_HUB_CONTEXT } from '../../shared/services/screen-contexts';
import { ViewportBreakpointService } from '../../shared/services/viewport-breakpoint.service';
import { DailyAdequacy } from '../daily-evolution/adequacy/adequacy.models';
import { AdequacySummaryComponent } from '../daily-evolution/adequacy/adequacy-summary.component';
import { DailyAdequacyService } from '../daily-evolution/adequacy/daily-adequacy.service';
import { DiagnosisSource } from '../diagnosis/diagnosis-source';
import { FollowUpStatusComponent } from '../follow-up-closure/follow-up-status.component';
import { HospitalContextService } from '../home/hospital-context.service';
import { LinkRevocationChecker } from '../home/link-revocation-checker';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import { UnreadNotificationsReader } from '../home/unread-notifications-reader';
import { AssessmentSource } from './assessment/assessment-source';
import { ChangeLocationAction } from './change-location/change-location.action';
import { MeasureChartComponent } from './charts/measure-chart.component';
import { ClinicalAssessmentEditorComponent } from './clinical-assessment/clinical-assessment-editor.component';
import { ClinicalAssessmentSource } from './clinical-assessment/clinical-assessment-source';
import { ClinicalTilesComponent } from './clinical-assessment/clinical-tiles.component';
import { DailyRecordEditorComponent } from './daily-record/daily-record-editor.component';
import { DiagnosisEditorComponent } from './diagnosis-editor/diagnosis-editor.component';
import { PatientEvolutionsComponent } from './evolutions/patient-evolutions.component';
import { PatientMessageSheetComponent } from './messages/patient-message-sheet.component';
import { MoveBedAction } from './move-bed/move-bed.action';
import { NutritionalFunctionalEditorComponent } from './nutritional-functional/nutritional-functional-editor.component';
import { NutritionalFunctionalTilesComponent } from './nutritional-functional/nutritional-functional-tiles.component';
import { PatientHubProfile } from './patient-hub.models';
import { PatientHubSource } from './patient-hub-source';
import { PlanSectionComponent } from './plan/plan-section.component';
import { Prescription } from './prescription/prescription.models';
import { PrescriptionEditorComponent } from './prescription/prescription-editor.component';
import { PrescriptionReviewComponent } from './prescription/prescription-review.component';
import { PrescriptionSource } from './prescription/prescription-source';
import { PrescriptionSummaryComponent } from './prescription/prescription-summary.component';
import { PriorStaysBoxComponent } from './prior-stays-box/prior-stays-box.component';
import { PROVISIONAL_BMI, PROVISIONAL_WEIGHT } from './provisional-measures';

type HubStatus = 'loading' | 'ready' | 'not-found' | 'error' | 'revoked';

/** Etapa do preenchimento da Hipótese: colar → carregando → revisão (IA) ou falha (manual). */

const PULL_THRESHOLD = 80;

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Lê `?data=aaaa-mm-dd` (a data filtrada na lista de pacientes); inválida ou futura = hoje. */
function dayFromQuery(raw: string | null | undefined, today: Date): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(raw ?? '');

  if (match === null) {
    return today;
  }
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return Number.isNaN(day.getTime()) || day > today ? today : day;
}

/** Voltar a ficar visível recarrega os resultados do painel; oculto não (sem polling nem stream). */
export function reloadsOnVisibility(state: DocumentVisibilityState): boolean {
  return state === 'visible';
}

/** Modo do cartão: leitura, colar novo texto (fluxo da IA) ou edição direta. Sem hipótese, sempre "paste". */
type CardMode = 'view' | 'empty';

const DAY_MS = 86_400_000;

export const DIAGNOSIS_OFFLINE_HINT = 'Sem conexão: o cálculo do diagnóstico precisa de conexão.';
export const DIAGNOSIS_FAILED_HINT =
  'Não foi possível calcular o diagnóstico agora. Abra a aba Diagnóstico para tentar de novo.';

/** Hub do paciente (FT-004-2): cabeçalho e cartão "Hipótese diagnóstica" (Figma 4608:4375 / 4608:4845). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    ClinicalTilesComponent,
    EmptyCardComponent,
    NutritionalFunctionalTilesComponent,
    DateStripComponent,
    PatientEvolutionsComponent,
    SectionHeaderComponent,
    PageHeaderComponent,
    MeasureChartComponent,
    ButtonComponent,
    FollowUpStatusComponent,
    PageContainerComponent,
    PatientMessageSheetComponent,
    PhIconComponent,
    PlanSectionComponent,
    PrescriptionSummaryComponent,
    PrescriptionReviewComponent,
    AdequacySummaryComponent,
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
  /** O sino do cabeçalho só aparece no desktop (Figma 4608:4378: o mobile tem só os atalhos). */
  protected readonly viewport = inject(ViewportBreakpointService);

  /** Equipe responsável (provisório: sai do cadastro da equipe quando houver a fonte real). */
  protected readonly responsible = { name: 'Dr. Wanderson Romualdo', role: 'Médico assistente' };
  /** Dia escolhido na faixa de datas (hoje por padrão); as Evoluções mostram o registro desse dia. */
  /** "Hoje" (relógio injetável): é o último dia da faixa e o dia aberto por padrão. */
  protected readonly today = inject(NOW)();
  protected readonly day = signal(this.today);
  /**
   * Somente leitura (Thiago, 2026-11-25): numa data anterior à de hoje o paciente mostra todos os dados, com as cores,
   * mas sem botões de editar nem de cadastrar. Vale também quando se volta no tempo pela faixa de datas.
   */
  protected readonly readOnly = computed(() => !sameDay(this.day(), this.today));
  protected readonly noRecordText = 'Sem registro nesta data.';
  /** Ícone da ação do título de cada seção: nenhum em somente leitura; ✓ com o editor aberto; senão o lápis. */
  protected readonly diagnosisActionIcon = computed(() =>
    this.actionIcon(this.mode() === 'empty', this.diagnosisEditing()),
  );
  protected readonly clinicalActionIcon = computed(() => this.actionIcon(false, this.clinicalEditing()));
  protected readonly nutritionalActionIcon = computed(() => this.actionIcon(false, this.nutritionalEditing()));
  /** Muda quando o Registro diário fecha: a evolução do dia é lida de novo. */
  protected readonly evolutionsVersion = signal(0);
  /** Muda quando o editor da Avaliação clínica salva: os cards são lidos de novo. */
  protected readonly clinicalVersion = signal(0);
  /** O editor da Avaliação clínica está aberto no painel: o card ganha destaque e o lápis vira o ✓ que salva. */
  protected readonly clinicalEditing = computed(
    () => this.aiAssistant.view() === 'editor' && this.aiAssistant.activeAction()?.id === 'clinical-assessment',
  );
  /** Muda quando o editor da Avaliação nutricional e funcional salva: os cards são lidos de novo. */
  protected readonly nutritionalVersion = signal(0);
  /** O editor da Avaliação nutricional e funcional está aberto no painel (mesmo padrão da Avaliação clínica). */
  protected readonly nutritionalEditing = computed(
    () => this.aiAssistant.view() === 'editor' && this.aiAssistant.activeAction()?.id === 'nutritional-functional',
  );
  /** Notificações não lidas, no sino do cabeçalho. */
  protected readonly unreadCount = signal(0);

  protected readonly status = signal<HubStatus>('loading');
  protected readonly revokedName = signal('');
  protected readonly profile = signal<PatientHubProfile | null>(null);
  /** Hipótese confirmada; `null` = ainda não preenchida. */
  protected readonly hypothesis = signal<string | null>(null);
  /** Sem diagnóstico, o card fica no estado vazio; tocar nele abre o cadastro no painel lateral. */
  protected readonly mode = computed<CardMode>(() => (this.hypothesis() === null ? 'empty' : 'view'));
  /** O editor do Diagnóstico está aberto no painel: o card ganha destaque e o lápis vira o ✓ que salva. */
  protected readonly diagnosisEditing = computed(
    () => this.aiAssistant.view() === 'editor' && this.aiAssistant.activeAction()?.id === 'diagnosis',
  );
  /** A avaliação clínica já tem dados (tipo de TN, dispositivo, peso ou algum item). */
  protected readonly clinicalFilled = signal(false);
  /** A avaliação nutricional e funcional já tem algum valor. */
  protected readonly nutritionalFilled = signal(false);
  /**
   * A tela se monta na ordem do fluxo (Thiago, 2026-11-25): Diagnóstico → Avaliação clínica → Avaliação nutricional e
   * funcional → Metas, Prescrição e Evoluções. Cada etapa só aparece quando a anterior tem dados.
   */
  protected readonly showClinical = computed(() => this.hypothesis() !== null);
  protected readonly showNutritional = computed(() => this.showClinical() && this.clinicalFilled());
  protected readonly showRest = computed(() => this.showNutritional() && this.nutritionalFilled());

  /** Observação/mensagem (FT-005-1) aberta pela ação dos atalhos; só cria pelo assistente. */
  protected readonly messageOpen = signal(false);
  /** Muda a cada registro gravado, para a lista de cards recarregar. */
  protected readonly messagesVersion = signal(0);
  /** Prescrição vigente exibida no Hub; `null` = sem prescrição (ou leitura falhou). */
  protected readonly prescription = signal<readonly Prescription[]>([]);
  /** Revisão diária da prescrição (FT-004-8), aberta pela ação dos atalhos; só para o médico. */
  protected readonly prescriptionReviewOpen = signal(false);

  /** Aviso do fluxo automático Avaliação → Diagnóstico (offline ou falha de leitura). */
  protected readonly diagnosisHint = signal<string | null>(null);

  protected readonly hospitalId = computed(() => this.context.selected()?.id ?? null);
  /** Tiles de "Metas nutricionais" (Figma 4608:4845), calculados da meta vigente quando há aporte calculado. */
  protected readonly targetTiles = computed(() => {
    const a = this.adequacy();

    if (a?.status !== 'available') {
      return null;
    }
    const n = (v: number): string => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

    return [
      { label: 'Calorias', unit: 'kcal/kg', value: n(a.targets.kcalPerKg) },
      { label: 'Meta calórica', unit: 'kcal/dia', value: n(a.targets.kcalPerDay) },
      { label: 'Proteína', unit: 'g/kg', value: n(a.targets.proteinPerKg) },
      { label: 'Meta proteica', unit: 'g/dia', value: n(a.targets.proteinPerDay) },
    ];
  });
  protected readonly weightSeries = PROVISIONAL_WEIGHT;
  protected readonly bmiSeries = PROVISIONAL_BMI;
  protected readonly hospitalName = computed(() => this.context.selected()?.name ?? '');
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

  /** % de adequação do dia (cálculo único, FT-004-7); `null` até a primeira leitura. */
  protected readonly adequacy = signal<DailyAdequacy | null>(null);
  private readonly screenActions = inject(ScreenActionsService);
  private readonly moveBed = inject(MoveBedAction);
  private readonly changeLocation = inject(ChangeLocationAction);
  private readonly source = inject(PatientHubSource);
  private readonly prescriptions = inject(PrescriptionSource);
  private readonly adequacyService = inject(DailyAdequacyService);
  private pullFrom: number | null = null;
  private readonly context = inject(HospitalContextService);
  private readonly revocation = inject(LinkRevocationChecker);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly aiAssistant = inject(AiAssistantService);
  private readonly editorController = inject(AssistantEditorController);
  private readonly diagnosisSource = inject(DiagnosisSource);
  private readonly clinicalSource = inject(ClinicalAssessmentSource);
  private readonly nutritionalSource = inject(AssessmentSource);
  private readonly now = inject(NOW);
  private readonly unread = inject(UnreadNotificationsReader);
  private readonly professional = inject(ProfessionalProfileReader);
  private readonly route = inject(ActivatedRoute);
  private readonly patientId = toSignal(this.route.paramMap.pipe(map(params => params.get('id'))), {
    initialValue: null,
  });

  constructor() {
    this.day.set(dayFromQuery(this.route.snapshot?.queryParamMap?.get('data'), this.today));
    effect(onCleanup => {
      onCleanup(this.screenActions.registerContext(PATIENT_HUB_CONTEXT));
    });

    // A ação só existe com o paciente carregado e hospital com vínculo aprovado em contexto.
    effect(onCleanup => {
      if (this.status() === 'ready' && this.hospitalId() !== null && !this.readOnly()) {
        const profile = this.profile();
        const actions: ScreenAction[] = [
          { id: 'daily-record', label: 'Registro diário', navigate: (): void => this.editDailyRecord() },
          {
            id: 'patient-message',
            label: 'Observação ou mensagem',
            navigate: (): void => this.messageOpen.set(true),
          },
        ];

        // US-002-2-01: o paciente em contexto é o da tela; o pedido vai para a internação mais recente dele.
        if (profile) {
          actions.push(
            this.moveBed.build({ id: profile.id, name: profile.name }),
            this.changeLocation.build({ id: profile.id, name: profile.name }),
          );
        }
        if (this.professional.read().role === 'doctor') {
          actions.push(
            {
              id: 'adjust-prescription',
              label: 'Ajustar a prescrição',
              navigate: (): void => this.editPrescription(),
            },
            {
              id: 'prescription-review',
              label: 'Revisão da prescrição',
              navigate: (): void => this.prescriptionReviewOpen.set(true),
            },
          );
        }
        onCleanup(this.screenActions.register(actions));
      }
    });
  }

  ngOnInit(): void {
    void this.loadUnread();
    void this.load();
    void this.reloadPrescription();
    void this.reloadResults();
  }

  /** Recarrega o aporte do dia; se falhar (ou offline), mantém o que já está na tela. */
  async reloadResults(): Promise<void> {
    const id = this.patientId();

    if (id === null) {
      return;
    }
    try {
      this.adequacy.set(await this.adequacyService.calculate(id));
    } catch {
      // mantém o valor atual
    }
  }

  /** A prescrição ajustada virou a vigente: o Hub passa a mostrá-la sem recarregar a página. */
  protected async reloadPrescription(): Promise<void> {
    const id = this.patientId();

    if (id === null) {
      return;
    }
    try {
      this.prescription.set(await this.prescriptions.load(id));
    } catch {
      // mantém a prescrição já exibida
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

  /** US-004-5-01 cenário 1: concluída a avaliação, abre o Diagnóstico só se há triagem positiva. */
  protected async onAssessmentConcluded(): Promise<void> {
    const id = this.patientId();

    this.diagnosisHint.set(null);
    if (id === null) {
      return;
    }
    if (!this.connectivity.online()) {
      this.diagnosisHint.set(DIAGNOSIS_OFFLINE_HINT);

      return;
    }
    try {
      if ((await this.diagnosisSource.load(id)).screeningPositive) {
        await this.router.navigate(['/patients', id, 'diagnosis']);
      }
    } catch {
      this.diagnosisHint.set(DIAGNOSIS_FAILED_HINT);
    }
  }

  protected openDiagnosis(): void {
    const id = this.patientId();

    if (id !== null) {
      void this.router.navigate(['/patients', id, 'diagnosis']);
    }
  }

  protected back(): void {
    this.location.back();
  }

  protected openNotifications(): void {
    void this.router.navigate(['/notifications']);
  }

  /** Lápis da Avaliação clínica: abre o editor no painel lateral (Figma 4775:26535). Com o editor aberto, é o ✓: salva. */
  protected editClinicalAssessment(): void {
    if (this.clinicalEditing()) {
      this.editorController.run('save');

      return;
    }
    const id = this.profile()?.id;

    if (id === undefined) {
      return;
    }
    this.aiAssistant.openAction({
      editor: {
        component: ClinicalAssessmentEditorComponent,
        description:
          'Insira manualmente os dados ou escreva uma mensagem com os dados que gostaria de alterar ou inserir.',
        hint: 'Você também pode enviar via áudio.',
        inputs: {
          patientId: id,
          saved: (): void => {
            this.clinicalVersion.update(v => v + 1);
            void this.refreshFlow();
          },
        },
        title: 'Avaliação clínica',
      },
      id: 'clinical-assessment',
      label: 'Avaliação clínica',
    });
  }

  /** Lápis da Avaliação nutricional e funcional: abre o editor no painel; com ele aberto, é o ✓ que salva. */
  protected editNutritionalFunctional(): void {
    if (this.nutritionalEditing()) {
      this.editorController.run('save');

      return;
    }
    const id = this.profile()?.id;

    if (id === undefined) {
      return;
    }
    this.aiAssistant.openAction({
      editor: {
        component: NutritionalFunctionalEditorComponent,
        description:
          'Insira manualmente os dados ou escreva uma mensagem com os dados que gostaria de alterar ou inserir.',
        hint: 'Você também pode enviar via áudio.',
        inputs: {
          patientId: id,
          saved: (): void => {
            this.nutritionalVersion.update(v => v + 1);
            void this.refreshFlow();
            void this.onAssessmentConcluded();
          },
        },
        title: 'Avaliação nutricional e funcional',
      },
      id: 'nutritional-functional',
      label: 'Avaliação nutricional e funcional',
    });
  }

  /** Lê de novo se as avaliações já têm dados: decide quais cards aparecem. Falha mantém o que já está. */
  protected async refreshFlow(): Promise<void> {
    const id = this.patientId();

    if (id === null) {
      return;
    }
    try {
      const clinical = await this.clinicalSource.load(id);

      this.clinicalFilled.set(
        clinical.tnType !== '' ||
          clinical.device !== '' ||
          clinical.weightKg !== null ||
          clinical.items.some(i => i.value !== ''),
      );
    } catch {
      // mantém
    }
    try {
      const latest = await this.nutritionalSource.loadLatest(id);

      this.nutritionalFilled.set(Object.values(latest?.values ?? {}).some(v => v.trim() !== ''));
    } catch {
      // mantém
    }
  }

  /** Card vazio ou lápis do Diagnóstico: abre o cadastro conversacional no painel lateral. Com ele aberto, o ✓ salva. */
  protected editDiagnosis(): void {
    if (this.diagnosisEditing()) {
      this.editorController.run('save');

      return;
    }
    const id = this.profile()?.id;

    if (id === undefined) {
      return;
    }
    this.aiAssistant.openAction({
      editor: {
        component: DiagnosisEditorComponent,
        description:
          'Cole ou escreva o texto do prontuário: motivo da internação, intercorrências e demais dados relevantes. ' +
          'Depois eu posso sintetizar o diagnóstico para você.',
        hint: 'Você também pode enviar via áudio.',
        inputs: {
          initialText: this.hypothesis() ?? '',
          patientId: id,
          responsibleName: this.responsible.name,
          responsibleRole: this.responsible.role,
          saved: (text: string): void => {
            this.hypothesis.set(text);
            void this.refreshFlow();
          },
        },
        title: 'Diagnóstico',
      },
      id: 'diagnosis',
      label: 'Diagnóstico',
    });
  }

  /** "Evoluir Paciente": abre a evolução (parâmetros, resultados e texto) no painel lateral conversacional. */
  protected editDailyRecord(): void {
    const id = this.profile()?.id;

    if (id === undefined) {
      return;
    }
    this.aiAssistant.openAction({
      editor: {
        component: DailyRecordEditorComponent,
        description:
          'Registre a evolução do paciente: insira manualmente os parâmetros e resultados ou escreva uma mensagem com os dados.',
        hint: 'Você também pode enviar via áudio.',
        inputs: {
          patientId: id,
          saved: (): void => {
            this.evolutionsVersion.update(v => v + 1);
          },
        },
        title: 'Evolução',
      },
      id: 'daily-record',
      label: 'Evolução',
    });
  }

  /** Card da prescrição ou ação "Ajustar a prescrição": abre a prescrição no painel lateral conversacional. */
  protected editPrescription(): void {
    const id = this.profile()?.id;
    const hospital = this.hospitalId();

    if (id === undefined || hospital === null) {
      return;
    }
    this.aiAssistant.openAction({
      editor: {
        component: PrescriptionEditorComponent,
        description:
          'Ajuste a prescrição: insira manualmente os dados ou use a última prescrição como ponto de partida.',
        hint: 'Você também pode enviar via áudio.',
        inputs: {
          hospitalId: hospital,
          patientId: id,
          saved: (): void => {
            void this.reloadPrescription();
          },
        },
        title: 'Prescrição',
      },
      id: 'adjust-prescription',
      label: 'Prescrição',
    });
  }

  private async loadUnread(): Promise<void> {
    try {
      this.unreadCount.set(await this.unread.countUnread());
    } catch {
      // sem contagem: o sino aparece sem selo
    }
  }

  /**
   * Chegou do cadastro do paciente (`?avaliar=1`): o médico faz a avaliação clínica agora. Abre o editor uma vez e tira o
   * parâmetro da URL (voltar ou recarregar não reabre).
   */
  private openAssessmentAfterRegistration(): void {
    if (this.route.snapshot?.queryParamMap?.get('avaliar') == null || this.profile() === null) {
      return;
    }
    this.editClinicalAssessment();
    void this.router.navigate([], { queryParams: { avaliar: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private actionIcon(hidden: boolean, editing: boolean): string | null {
    if (hidden || this.readOnly()) {
      return null;
    }

    return editing ? 'check' : 'pencil-simple-line';
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
      await this.refreshFlow();
      this.status.set(profile === null ? 'not-found' : 'ready');
      this.openAssessmentAfterRegistration();
    } catch (failure) {
      const hospital = this.context.selected();

      // 403 também é "sem permissão": só vira revogação se o vínculo constar como REVOGADO (US-001-2-04, Cenário 2).
      if (
        (failure as { status?: number }).status === 403 &&
        hospital !== null &&
        (await this.revocation.isRevoked(hospital.id))
      ) {
        this.revokedName.set(hospital.name);
        this.context.revokeAccess(hospital.id);
        this.status.set('revoked');
      } else {
        this.status.set('error');
      }
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
