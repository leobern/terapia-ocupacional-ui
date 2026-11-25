import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { DateStripComponent } from '../../shared/components/date-strip/date-strip.component';
import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { AssistantEditorController } from '../../shared/services/assistant-editor-controller.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { ScreenActionsService } from '../../shared/services/screen-actions.service';
import { ViewportBreakpointService } from '../../shared/services/viewport-breakpoint.service';
import { DailyAdequacy } from '../daily-evolution/adequacy/adequacy.models';
import { DailyAdequacyService } from '../daily-evolution/adequacy/daily-adequacy.service';
import { GlimReading } from '../diagnosis/diagnosis.models';
import { DiagnosisSource } from '../diagnosis/diagnosis-source';
import { FollowUpClosureSource, FollowUpClosureWriter } from '../follow-up-closure/follow-up-closure-source';
import { ProvisionalFollowUpClosureSource } from '../follow-up-closure/provisional-follow-up-closure';
import { HospitalContextService } from '../home/hospital-context.service';
import { LinkRevocationChecker } from '../home/link-revocation-checker';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import { UnreadNotificationsReader } from '../home/unread-notifications-reader';
import {
  PatientMessagesSource,
  PatientMessagesWriter,
  ReplyTranscriber,
} from '../patient-messages/patient-messages-source';
import {
  ProvisionalPatientMessages,
  ProvisionalReplyTranscriber,
} from '../patient-messages/provisional-patient-messages';
import { FormulasApi } from '../pharmacy/formulas-api';
import { AssessmentAiStructurer } from './assessment/assessment-ai-structurer';
import { AssessmentSource } from './assessment/assessment-source';
import { AssessmentWriter } from './assessment/assessment-writer';
import { LocationChangePort, LocationExtractor } from './change-location/location-change.port';
import { ClinicalAssessmentSource } from './clinical-assessment/clinical-assessment-source';
import { ClinicalItemHistorySource } from './clinical-assessment/clinical-item-history-source';
import { ProvisionalClinicalAssessmentSource } from './clinical-assessment/provisional-clinical-assessment-source';
import { ProvisionalClinicalItemHistorySource } from './clinical-assessment/provisional-clinical-item-history-source';
import { DailyEvolutionSource } from './daily-record/daily-evolution-source';
import { DailyRecordSource } from './daily-record/daily-record-source';
import { DailyRecordWriter } from './daily-record/daily-record-writer';
import { EvolutionAiStructurer } from './daily-record/evolution-ai-structurer';
import { ParameterAiStructurer } from './daily-record/parameter-ai-structurer';
import { MessageAiAssistant, PatientMessageSource, PatientTeamSource } from './messages/patient-message-source';
import { BedMovementPort, BedOccupancyPort } from './move-bed/bed-movement.port';
import { BedNumberExtractor } from './move-bed/bed-number-extractor';
import {
  DIAGNOSIS_FAILED_HINT,
  DIAGNOSIS_OFFLINE_HINT,
  PatientHubComponent,
  reloadsOnVisibility,
} from './patient-hub.component';
import { HypothesisSaveRequest, PatientHubProfile } from './patient-hub.models';
import {
  HypothesisSynthesizer,
  HypothesisWriter,
  PatientHubSource,
  PriorStaysSource,
  PriorStaysSynthesizer,
} from './patient-hub-source';
import { NutritionTargetsReader } from './plan/nutrition-targets-reader';
import { PlanSource } from './plan/plan-source';
import { RefeedingRiskSource } from './plan/refeeding-risk-source';
import { Prescription } from './prescription/prescription.models';
import { PrescriptionSheetComponent } from './prescription/prescription-sheet.component';
import { PrescriptionSource } from './prescription/prescription-source';

const PROFILE: PatientHubProfile = {
  bed: '35',
  birthDate: '1959-04-13',
  id: 'p1',
  name: 'José Raimundo Soares Neto',
  therapy: 'NE',
  therapyStartDate: '2026-05-26',
  ward: 'Ala 2',
};

const revocation = { revoked: true, isRevoked: (): Promise<boolean> => Promise.resolve(revocation.revoked) };
const locationMock = { back: jasmine.createSpy('back') };

class FakeSource extends PatientHubSource {
  profile: PatientHubProfile | null = PROFILE;
  hypothesis: string | null = 'Insuficiência respiratória aguda.';
  fail = false;
  denied = false;

  loadProfile(): Promise<PatientHubProfile | null> {
    if (this.denied) {
      return Promise.reject({ status: 403 });
    }

    return this.fail ? Promise.reject(new Error('x')) : Promise.resolve(this.profile);
  }

  loadHypothesis(): Promise<string | null> {
    return Promise.resolve(this.hypothesis);
  }
}

class FakeSynth extends HypothesisSynthesizer {
  result: Promise<string> = Promise.resolve('Texto da IA');
  readonly calls: string[] = [];

  synthesize(text: string): Promise<string> {
    this.calls.push(text);

    return this.result;
  }
}

class FakeWriter extends HypothesisWriter {
  readonly saved: HypothesisSaveRequest[] = [];
  fail = false;

  save(request: HypothesisSaveRequest): Promise<void> {
    if (this.fail) {
      return Promise.reject(new Error('x'));
    }
    this.saved.push(request);

    return Promise.resolve();
  }
}

class FakePriorStays extends PriorStaysSource {
  has = false;
  fail = false;
  readonly calls: string[] = [];

  hasPriorStays(patientId: string, hospitalId: number): Promise<boolean> {
    this.calls.push(`${hospitalId}:${patientId}`);

    return this.fail ? Promise.reject(new Error('x')) : Promise.resolve(this.has);
  }
}

class FakePriorSynth extends PriorStaysSynthesizer {
  result: Promise<string> = Promise.resolve('Síntese de internações anteriores');

  synthesize(): Promise<string> {
    return this.result;
  }
}

class FakeDiagnosis extends DiagnosisSource {
  screening = true;
  fail = false;

  load(): Promise<GlimReading> {
    return this.fail
      ? Promise.reject(new Error('x'))
      : Promise.resolve({
          criteria: {
            inflammation: 'not-evaluated',
            'low-bmi': 'not-evaluated',
            'low-muscle-mass': 'not-evaluated',
            'reduced-intake': 'not-evaluated',
            'weight-loss': 'not-evaluated',
          },
          fluidRetention: false,
          protocols: [],
          screeningPositive: this.screening,
          severity: {},
        });
  }
}

const diagnosis = new FakeDiagnosis();
const priorStays = new FakePriorStays();
const priorSynth = new FakePriorSynth();
const prescriptionStore: { fail: boolean; value: Prescription | null } = { fail: false, value: null };
const PRESCRIPTION: Prescription = {
  route: 'NE',
  at: '2026-11-21T10:00:00Z',
  author: 'Michelle',
  formulaId: 'a',
  formulaName: 'Fórmula Hub',
  kcalPerMl: 1,
  modality: 'continuous',
  nursingNotes: '',
  pauseTimes: [],
  proteinPerMl: 0.04,
  startTime: '08:00',
  volumeMl: 900,
};
const synth = new FakeSynth();
const writer = new FakeWriter();

class FakeAdequacy {
  calls = 0;
  fail = false;
  result: DailyAdequacy = { reason: 'no-target', status: 'unavailable' };

  calculate(): Promise<DailyAdequacy> {
    this.calls += 1;

    return this.fail ? Promise.reject(new Error('x')) : Promise.resolve(this.result);
  }
}

const adequacy = new FakeAdequacy();
const AVAILABLE: DailyAdequacy = {
  calories: { intake: 1425, percent: 76, target: 1875 },
  protein: { intake: 82.5, percent: 73, target: 112.5 },
  sources: { food: null, infusion: { kcal: 1425, proteinG: 82.5 } },
  status: 'available',
  targets: {
    calorimetry: null,
    formula: 'simplified',
    kcalPerDay: 1875,
    kcalPerKg: 25,
    proteinPerDay: 112.5,
    proteinPerKg: 1.5,
    referenceWeight: { kg: 75, kind: 'current' },
  },
};

const desktop = signal(true);
const unread = { countUnread: (): Promise<number> => Promise.resolve(3) };

async function setup(
  source: FakeSource,
  id: string | null = 'p1',
  hospitals: unknown[] = [{ id: 1, name: 'Hospital Vila Nova Star' }],
  role = 'doctor',
  query: Record<string, string> = {},
): Promise<ComponentFixture<PatientHubComponent>> {
  if (!jasmine.isSpy(Object.getOwnPropertyDescriptor(navigator, 'language')?.get as () => string)) {
    spyOnProperty(navigator, 'language').and.returnValue('pt-BR');
  }
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Location, useValue: locationMock },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap(id === null ? {} : { id })),
          snapshot: { queryParamMap: convertToParamMap(query) },
        },
      },
      { provide: PatientHubSource, useValue: source },
      { provide: BedMovementPort, useValue: { resolve: (): Promise<never> => Promise.reject(new Error('x')) } },
      { provide: BedOccupancyPort, useValue: { check: (): Promise<never> => Promise.reject(new Error('x')) } },
      { provide: BedNumberExtractor, useValue: { extract: (): null => null } },
      { provide: LocationChangePort, useValue: {} },
      { provide: LocationExtractor, useValue: { extract: (): null => null } },
      { provide: LinkRevocationChecker, useValue: revocation },
      { provide: DailyAdequacyService, useValue: adequacy },
      { provide: HypothesisSynthesizer, useValue: synth },
      { provide: HypothesisWriter, useValue: writer },
      { provide: DiagnosisSource, useValue: diagnosis },
      {
        provide: PlanSource,
        useValue: {
          loadRoute: (): Promise<null> => Promise.resolve(null),
          loadSwallowing: (): Promise<null> => Promise.resolve(null),
          loadCadence: (): Promise<null> => Promise.resolve(null),
          loadResponsible: (): Promise<null> => Promise.resolve(null),
          loadResponsibleOptions: (): Promise<string[]> => Promise.resolve([]),
        },
      },
      { provide: DailyEvolutionSource, useValue: { load: (): Promise<null> => Promise.resolve(null) } },
      { provide: EvolutionAiStructurer, useValue: { suggest: (): Promise<string> => Promise.resolve('') } },
      { provide: PatientMessageSource, useValue: { list: (): Promise<readonly never[]> => Promise.resolve([]) } },
      { provide: PatientTeamSource, useValue: { listLinked: (): Promise<readonly never[]> => Promise.resolve([]) } },
      { provide: MessageAiAssistant, useValue: {} },
      { provide: ParameterAiStructurer, useValue: { suggest: (): Promise<readonly never[]> => Promise.resolve([]) } },
      { provide: RefeedingRiskSource, useValue: { load: (): Promise<null> => Promise.resolve(null) } },
      {
        provide: AssessmentSource,
        useValue: { loadLatest: (): Promise<object> => Promise.resolve({ previous: {}, values: { handgrip: '14' } }) },
      },
      { provide: AssessmentAiStructurer, useValue: { structure: (): Promise<object> => Promise.resolve({}) } },
      { provide: AssessmentWriter, useValue: { save: (): Promise<void> => Promise.resolve() } },
      { provide: DailyRecordSource, useValue: { loadEntries: (): Promise<[]> => Promise.resolve([]) } },
      { provide: DailyRecordWriter, useValue: { record: (): Promise<[]> => Promise.resolve([]) } },
      { provide: FormulasApi, useValue: { list: (): Promise<[]> => Promise.resolve([]) } },
      { provide: NutritionTargetsReader, useValue: { current: (): Promise<null> => Promise.resolve(null) } },
      ProvisionalPatientMessages,
      {
        provide: PatientMessagesSource,
        useValue: {
          list: (): Promise<[]> => Promise.resolve([]),
          listBySender: (): Promise<[]> => Promise.resolve([]),
        },
      },
      { provide: PatientMessagesWriter, useExisting: ProvisionalPatientMessages },
      { provide: ReplyTranscriber, useClass: ProvisionalReplyTranscriber },
      ProvisionalFollowUpClosureSource,
      { provide: FollowUpClosureSource, useExisting: ProvisionalFollowUpClosureSource },
      { provide: FollowUpClosureWriter, useExisting: ProvisionalFollowUpClosureSource },
      { provide: PriorStaysSource, useValue: priorStays },
      { provide: PriorStaysSynthesizer, useValue: priorSynth },
      {
        provide: ProfessionalProfileReader,
        useValue: { read: (): { name: string; role: string } => ({ name: 'Michelle', role }) },
      },
      {
        provide: PrescriptionSource,
        useValue: {
          load: (): Promise<readonly Prescription[]> => {
            const list = prescriptionStore.value === null ? [] : [prescriptionStore.value];

            return prescriptionStore.fail ? Promise.reject(new Error('x')) : Promise.resolve(list);
          },
          loadActive: (): Promise<readonly never[]> => Promise.resolve([]),
          loadReview: (): Promise<null> => Promise.resolve(null),
        },
      },
      { provide: NOW, useValue: (): Date => new Date(2026, 4, 28, 12) },
      { provide: UnreadNotificationsReader, useValue: unread },
      { provide: ClinicalAssessmentSource, useClass: ProvisionalClinicalAssessmentSource },
      { provide: ClinicalItemHistorySource, useClass: ProvisionalClinicalItemHistorySource },
      { provide: ViewportBreakpointService, useValue: { isDesktop: desktop } },
      {
        provide: LinkedHospitalsReader,
        useValue: { read: (): Promise<unknown[]> => Promise.resolve(hospitals) },
      },
    ],
  });
  await TestBed.inject(HospitalContextService).load();
  const fixture = TestBed.createComponent(PatientHubComponent);

  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

const text = (f: ComponentFixture<unknown>): string => (f.nativeElement as HTMLElement).textContent ?? '';

/** Botão só com ícone (ex.: o lápis do título), achado pelo nome acessível. */
const clickLabel = async (f: ComponentFixture<unknown>, label: string): Promise<void> => {
  (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.click();
  await f.whenStable();
  f.detectChanges();
};

describe('PatientHubComponent', () => {
  beforeEach(() => {
    revocation.revoked = true;
    prescriptionStore.fail = false;
    prescriptionStore.value = null;
    adequacy.calls = 0;
    adequacy.result = { reason: 'no-target', status: 'unavailable' };
    adequacy.fail = false;
    priorStays.has = false;
    priorStays.fail = false;
    priorStays.calls.length = 0;
  });

  it('mostra a caixa de internações anteriores recolhida só quando há histórico no hospital em contexto', async () => {
    priorStays.has = true;
    const f = await setup(new FakeSource());

    await f.whenStable();
    f.detectChanges();

    expect(priorStays.calls).toEqual(['1:p1']);
    expect(text(f)).toContain('Internações anteriores');
    expect(f.nativeElement.querySelector('.stays__header').getAttribute('aria-expanded')).toBe('false');
  });

  it('403 sem vínculo revogado (ex.: sem permissão) mostra erro comum e mantém o hospital no contexto', async () => {
    const source = new FakeSource();

    source.denied = true;
    revocation.revoked = false;
    const f = await setup(source, 'p1', [{ id: 1, name: 'Hospital Vila Nova Star' }]);

    await f.whenStable();
    f.detectChanges();

    expect(text(f)).not.toContain('foi revogado');
    expect(TestBed.inject(HospitalContextService).selected()?.id).toBe(1);
  });

  it('acesso negado (403) bloqueia os dados, avisa em texto e tira o hospital do contexto (US-001-2-04)', async () => {
    const source = new FakeSource();

    source.denied = true;
    const f = await setup(source, 'p1', [
      { id: 1, name: 'Hospital Vila Nova Star' },
      { id: 2, name: 'Hospital B' },
    ]);

    await f.whenStable();
    f.detectChanges();

    expect(text(f)).toContain('Seu acesso a Hospital Vila Nova Star foi revogado');
    expect(text(f)).not.toContain('José Raimundo');
    expect(TestBed.inject(HospitalContextService).selected()?.id).toBe(2);
  });

  describe('Prescrição ativa', () => {
    it('mostra a prescrição vigente e passa a mostrar a nova depois de salva, sem recarregar', async () => {
      prescriptionStore.value = PRESCRIPTION;
      const f = await setup(new FakeSource());

      expect(text(f)).toContain('Fórmula Hub');
      prescriptionStore.value = { ...PRESCRIPTION, formulaName: 'Fórmula nova' };
      (
        f.debugElement.query(By.directive(PrescriptionSheetComponent)).componentInstance as PrescriptionSheetComponent
      ).saved.emit();
      await f.whenStable();
      f.detectChanges();

      expect(text(f)).toContain('Fórmula nova');
      expect(text(f)).not.toContain('Fórmula Hub');
    });

    it('sem prescrição não mostra o resumo; falha ao recarregar mantém o exibido', async () => {
      const f = await setup(new FakeSource());

      expect(f.nativeElement.querySelector('app-prescription-summary [data-testid="rx-summary"]')).toBeNull();
      prescriptionStore.value = PRESCRIPTION;
      await (f.componentInstance as unknown as { reloadPrescription: () => Promise<void> }).reloadPrescription();
      f.detectChanges();

      expect(text(f)).toContain('Fórmula Hub');
      prescriptionStore.fail = true;
      await (f.componentInstance as unknown as { reloadPrescription: () => Promise<void> }).reloadPrescription();
      f.detectChanges();

      expect(text(f)).toContain('Fórmula Hub');
    });
  });

  describe('Registro diário', () => {
    it('registra a ação "Registro diário" nos atalhos e abre o registro ao escolhê-la', async () => {
      const f = await setup(new FakeSource());
      const actions = TestBed.inject(ScreenActionsService).actions();
      const dialog = (): HTMLDialogElement =>
        (f.nativeElement as HTMLElement).querySelector('app-daily-record-sheet dialog') as HTMLDialogElement;

      expect(actions.map(a => a.label)).toEqual([
        'Registro diário',
        'Observação ou mensagem',
        'Movimentar leito',
        'Alterar unidade/ala',
        'Ajustar a prescrição',
        'Revisão da prescrição',
      ]);

      expect(dialog().open).toBe(false);
      actions[0].navigate?.();
      f.detectChanges();
      await f.whenStable();

      expect(dialog().open).toBe(true);
      dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
      f.detectChanges();

      expect(dialog().open).toBe(false);
    });

    it('a ação "Observação ou mensagem" abre o registro do assistente e o fecha com Esc', async () => {
      const f = await setup(new FakeSource());
      const action = TestBed.inject(ScreenActionsService)
        .actions()
        .find(a => a.id === 'patient-message');
      const dialog = (): HTMLDialogElement =>
        (f.nativeElement as HTMLElement).querySelector('app-patient-message-sheet dialog') as HTMLDialogElement;

      expect(dialog().open).toBe(false);
      action?.navigate?.();
      f.detectChanges();
      await f.whenStable();

      expect(dialog().open).toBe(true);
      dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
      f.detectChanges();

      expect(dialog().open).toBe(false);
    });

    it('perfil não médico não recebe a ação "Revisão da prescrição"', async () => {
      await setup(new FakeSource(), 'p1', [{ id: 1, name: 'Hospital Vila Nova Star' }], 'other');

      expect(
        TestBed.inject(ScreenActionsService)
          .actions()
          .map(a => a.label),
      ).toEqual(['Registro diário', 'Observação ou mensagem', 'Movimentar leito', 'Alterar unidade/ala']);
    });

    it('médico abre a revisão da prescrição pelos atalhos e fecha com Esc', async () => {
      const f = await setup(new FakeSource());
      const action = TestBed.inject(ScreenActionsService)
        .actions()
        .find(a => a.id === 'prescription-review');
      const dialog = (): HTMLDialogElement =>
        (f.nativeElement as HTMLElement).querySelector('app-prescription-review dialog') as HTMLDialogElement;

      action?.navigate?.();
      f.detectChanges();
      await f.whenStable();

      expect(dialog().open).toBe(true);
      dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
      f.detectChanges();

      expect(dialog().open).toBe(false);
    });

    it('"Ajustar a prescrição" abre a revisão da prescrição e só existe para o médico', async () => {
      const f = await setup(new FakeSource());
      const dialog = (): HTMLDialogElement =>
        (f.nativeElement as HTMLElement).querySelector('app-prescription-sheet dialog') as HTMLDialogElement;
      const action = TestBed.inject(ScreenActionsService)
        .actions()
        .find(a => a.id === 'adjust-prescription');

      expect(dialog().open).toBe(false);
      action?.navigate?.();
      f.detectChanges();
      await f.whenStable();

      expect(dialog().open).toBe(true);
      dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
      f.detectChanges();

      expect(dialog().open).toBe(false);
    });

    it('sem hospital com vínculo em contexto, a ação não é oferecida', async () => {
      await setup(new FakeSource(), 'p1', []);

      expect(TestBed.inject(ScreenActionsService).actions()).toEqual([]);
    });

    it('a ação sai dos atalhos quando o Hub é destruído', async () => {
      const f = await setup(new FakeSource());

      f.destroy();

      expect(TestBed.inject(ScreenActionsService).actions()).toEqual([]);
    });
  });

  it('sem histórico (ou sem hospital em contexto), a caixa não aparece', async () => {
    const f = await setup(new FakeSource());

    expect(text(f)).not.toContain('Internações anteriores');
    TestBed.resetTestingModule();
    const g = await setup(new FakeSource(), 'p1', []);

    expect(text(g)).not.toContain('Internações anteriores');
  });

  it('mostra identificação e a Hipótese completa quando preenchida', async () => {
    const f = await setup(new FakeSource());

    expect(text(f)).toContain('Hospital Vila Nova Star');
    expect(text(f)).not.toContain('Quinta-feira, 28 de maio');
    expect(text(f)).toContain('Ala 2 · Leito 35');
    expect(text(f)).toContain('José Raimundo Soares Neto');
    expect(text(f)).toContain('67 anos · 13/04/1959');
    expect(text(f)).toContain('Terapia há 2 dias');
    expect(text(f)).toContain('Insuficiência respiratória aguda.');
    expect((f.nativeElement as HTMLElement).querySelector('textarea:not(.input-chat__field)')).toBeNull();
  });

  it('sem Hipótese, só aparece o card de estado vazio do Diagnóstico (sem editar e sem os outros cards); tocar abre o editor', async () => {
    const source = new FakeSource();

    source.hypothesis = null;
    const f = await setup(source);
    const root = f.nativeElement as HTMLElement;

    expect(text(f)).toContain('Toque aqui e insira o diagnóstico.');
    expect(root.querySelector('[aria-label="Editar diagnóstico"]')).toBeNull();
    expect(root.querySelector('textarea:not(.input-chat__field)')).toBeNull();
    expect(Array.from(root.querySelectorAll('app-section-header h2')).map(h => h.textContent.trim())).toEqual([
      'Diagnóstico',
    ]);

    root.querySelector<HTMLButtonElement>('app-empty-card button')?.click();
    f.detectChanges();

    expect(TestBed.inject(AiAssistantService).activeAction()?.id).toBe('diagnosis');
  });

  describe('% de adequação (FT-004-7, US3)', () => {
    it('o resumo do Hub mostra o resultado calculado', async () => {
      adequacy.result = AVAILABLE;
      const f = await setup(new FakeSource());

      expect(text(f)).toContain('76% da meta (1.875 kcal)');
      expect(text(f)).toContain('73% da meta (112,5 g)');
    });

    it('sem meta, o resumo fica indisponível com orientação, sem percentual', async () => {
      const f = await setup(new FakeSource());

      expect(text(f)).toContain('defina a meta calórica e proteica no Plano de intervenção');
      expect(text(f)).not.toContain('% da meta');
    });

    it('falha no cálculo mantém o que já estava exibido', async () => {
      adequacy.result = AVAILABLE;
      const f = await setup(new FakeSource());

      adequacy.fail = true;
      window.dispatchEvent(new Event('focus'));
      await f.whenStable();
      f.detectChanges();

      expect(text(f)).toContain('76% da meta (1.875 kcal)');
    });
  });

  describe('recarga do aporte (foco, visibilidade e puxar para atualizar)', () => {
    it('retomar o foco recarrega o aporte; falha mantém o que estava na tela', async () => {
      adequacy.result = AVAILABLE;
      const f = await setup(new FakeSource());
      const before = adequacy.calls;

      window.dispatchEvent(new Event('focus'));
      await f.whenStable();
      f.detectChanges();

      expect(adequacy.calls).toBeGreaterThan(before);
      adequacy.fail = true;
      window.dispatchEvent(new Event('focus'));
      await f.whenStable();
      f.detectChanges();

      expect(text(f)).toContain('76% da meta (1.875 kcal)');
    });

    it('regra de visibilidade: visível recarrega; oculto não', () => {
      expect(reloadsOnVisibility('visible')).toBeTrue();
      expect(reloadsOnVisibility('hidden')).toBeFalse();
    });

    it('sem id na rota não busca o aporte', async () => {
      adequacy.calls = 0;
      await setup(new FakeSource(), null);

      expect(adequacy.calls).toBe(0);
    });

    it('o tratador de visibilidade e o puxar com a página rolada percorrem os dois ramos', async () => {
      const f = await setup(new FakeSource());
      const before = adequacy.calls;
      let state: DocumentVisibilityState = 'visible';

      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      const hub = f.componentInstance as unknown as { onVisibility(): void };

      hub.onVisibility();
      const afterVisible = adequacy.calls;

      state = 'hidden';
      hub.onVisibility();
      delete (document as unknown as Record<string, unknown>)['visibilityState'];

      expect(afterVisible).toBeGreaterThan(before);
      spyOnProperty(window, 'scrollY', 'get').and.returnValue(120);
      const el = f.nativeElement as HTMLElement;
      const point = new Touch({ clientX: 0, clientY: 10, identifier: 1, target: el });

      el.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [point], touches: [point] }));
      await f.whenStable();
    });

    it('arrasto curto ou sem toque inicial não recarrega', async () => {
      const f = await setup(new FakeSource());
      const before = adequacy.calls;
      const el = f.nativeElement as HTMLElement;
      const touch = (type: string, y: number): TouchEvent => {
        const point = new Touch({ clientX: 0, clientY: y, identifier: 1, target: el });

        return new TouchEvent(type, { changedTouches: [point], touches: type === 'touchstart' ? [point] : [] });
      };

      el.dispatchEvent(touch('touchstart', 10));
      el.dispatchEvent(touch('touchend', 50));
      el.dispatchEvent(touch('touchend', 300));
      await f.whenStable();

      expect(adequacy.calls).toBe(before);
    });

    it('puxar para atualizar (arrasto > 80px a partir do topo) recarrega', async () => {
      const f = await setup(new FakeSource());
      const before = adequacy.calls;
      const touch = (type: string, y: number): TouchEvent =>
        new TouchEvent(type, {
          changedTouches: [new Touch({ clientX: 0, clientY: y, identifier: 1, target: f.nativeElement })],
          touches:
            type === 'touchstart'
              ? [new Touch({ clientX: 0, clientY: y, identifier: 1, target: f.nativeElement })]
              : [],
        });

      (f.nativeElement as HTMLElement).dispatchEvent(touch('touchstart', 10));
      (f.nativeElement as HTMLElement).dispatchEvent(touch('touchend', 150));
      await f.whenStable();

      expect(adequacy.calls).toBeGreaterThan(before);
    });
  });

  it('indica paciente não encontrado', async () => {
    const source = new FakeSource();

    source.profile = null;

    expect(text(await setup(source))).toContain('Paciente não encontrado');
    TestBed.resetTestingModule();

    expect(text(await setup(new FakeSource(), null))).toContain('Paciente não encontrado');
  });

  it('indica erro de carregamento', async () => {
    const source = new FakeSource();

    source.fail = true;

    expect(text(await setup(source))).toContain('Não foi possível carregar');
  });

  it('formata terapia iniciada hoje e no singular, e volta ao histórico', async () => {
    const source = new FakeSource();

    source.profile = { ...PROFILE, birthDate: '1959-06-01', therapyStartDate: '2026-05-28' };
    const f = await setup(source);

    expect(text(f)).toContain('66 anos');
    expect(text(f)).toContain('Terapia iniciada hoje');

    TestBed.resetTestingModule();
    source.profile = { ...PROFILE, therapyStartDate: '2026-05-27' };

    expect(text(await setup(source))).toContain('Terapia há 1 dia');
  });

  it('calcula a idade no mês do aniversário e funciona sem hospital em contexto', async () => {
    const source = new FakeSource();

    source.profile = { ...PROFILE, birthDate: '1959-05-30' };

    expect(text(await setup(source, 'p1', []))).toContain('66 anos');

    TestBed.resetTestingModule();
    source.profile = { ...PROFILE, birthDate: '1959-05-10' };

    expect(text(await setup(source))).toContain('67 anos');
  });

  it('volta ao clicar na seta', async () => {
    const f = await setup(new FakeSource());

    (f.nativeElement as HTMLElement).querySelector<HTMLElement>('app-icon-button button')?.click();

    expect(locationMock.back).toHaveBeenCalledOnceWith();
  });

  describe('Diagnóstico (FT-004-5)', () => {
    let f: ComponentFixture<PatientHubComponent>;
    let navigate: jasmine.Spy;
    const concluded = async (): Promise<void> => {
      await (f.componentInstance as unknown as { onAssessmentConcluded(): Promise<void> }).onAssessmentConcluded();
      f.detectChanges();
    };

    beforeEach(async () => {
      diagnosis.screening = true;
      diagnosis.fail = false;
      f = await setup(new FakeSource());
      navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    });

    it('concluir a avaliação com triagem positiva abre o Diagnóstico', async () => {
      await concluded();

      expect(navigate).toHaveBeenCalledOnceWith(['/patients', 'p1', 'diagnosis']);
    });

    it('concluir sem triagem positiva não abre o Diagnóstico', async () => {
      diagnosis.screening = false;
      await concluded();

      expect(navigate).not.toHaveBeenCalled();
    });

    it('offline: não calcula e avisa que precisa de conexão', async () => {
      TestBed.inject(ConnectivityService).online.set(false);
      await concluded();

      expect(navigate).not.toHaveBeenCalled();
      expect((f.nativeElement as HTMLElement).textContent).toContain(DIAGNOSIS_OFFLINE_HINT);
      TestBed.inject(ConnectivityService).online.set(true);
    });

    it('falha na leitura: avisa e não navega', async () => {
      diagnosis.fail = true;
      await concluded();

      expect(navigate).not.toHaveBeenCalled();
      expect((f.nativeElement as HTMLElement).textContent).toContain(DIAGNOSIS_FAILED_HINT);
    });

    it('o botão "Salvar avaliação" do formulário salva e dispara o fluxo do diagnóstico', async () => {
      const root = f.nativeElement as HTMLElement;

      const press = async (label: string): Promise<void> => {
        root.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)?.click();
        await f.whenStable();
        f.detectChanges();
        await f.whenStable();
      };

      // lápis abre o editor no painel; o ✓ salva e dispara o fluxo do diagnóstico
      await press('Editar avaliação nutricional e funcional');
      // o editor (renderizado no painel do app) avisa a tela pelo callback `saved` ao gravar
      const inputs = TestBed.inject(AiAssistantService).activeAction()?.editor?.inputs as { saved: () => void };

      inputs.saved();
      await f.whenStable();

      expect(navigate).toHaveBeenCalledOnceWith(['/patients', 'p1', 'diagnosis']);
    });

    it('o Hub dá acesso ao Diagnóstico a qualquer momento', () => {
      (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.hub__diagnosis')?.click();

      expect(navigate).toHaveBeenCalledOnceWith(['/patients', 'p1', 'diagnosis']);
    });
  });

  it('sem id de paciente, nada acontece', async () => {
    const g = await setup(new FakeSource(), null);
    const router = TestBed.inject(Router);

    spyOn(router, 'navigate');
    const c = g.componentInstance as unknown as { onAssessmentConcluded(): Promise<void>; openDiagnosis(): void };

    await c.onAssessmentConcluded();
    c.openDiagnosis();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  describe('cadastro do Diagnóstico no painel lateral', () => {
    const el = (f: ComponentFixture<PatientHubComponent>): HTMLElement => f.nativeElement as HTMLElement;
    const open = async (f: ComponentFixture<PatientHubComponent>): Promise<void> => {
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();
    };

    it('tocar no card vazio abre o editor no painel (sem campos dentro do card)', async () => {
      const source = new FakeSource();

      source.hypothesis = null;
      const f = await setup(source);
      const assistant = TestBed.inject(AiAssistantService);

      el(f).querySelector<HTMLButtonElement>('app-empty-card button')?.click();
      await open(f);

      expect(assistant.view()).toBe('editor');
      expect(assistant.activeAction()?.id).toBe('diagnosis');
      expect(el(f).querySelector('textarea:not(.input-chat__field)')).toBeNull();
    });

    it('o lápis abre o editor com o texto atual; o card ganha destaque e o lápis vira o ✓', async () => {
      const f = await setup(new FakeSource());
      const assistant = TestBed.inject(AiAssistantService);

      expect(el(f).querySelector('.hub__diag--editing')).toBeNull();
      await clickLabel(f, 'Editar diagnóstico');
      await open(f);

      const inputs = assistant.activeAction()?.editor?.inputs as { initialText: string; responsibleName: string };

      expect(assistant.activeAction()?.id).toBe('diagnosis');
      expect(inputs.initialText).toContain('Insuficiência respiratória aguda.');
      expect(inputs.responsibleName).toBe('Dr. Wanderson Romualdo');
      expect(el(f).querySelector('.hub__diag--editing')).not.toBeNull();
      expect(el(f).querySelector('[aria-label="Salvar diagnóstico"]')).not.toBeNull();
    });

    it('o ✓ do card pede o salvamento ao editor', async () => {
      const f = await setup(new FakeSource());

      spyOn(TestBed.inject(AssistantEditorController), 'run');

      await clickLabel(f, 'Editar diagnóstico');
      await open(f);
      await clickLabel(f, 'Salvar diagnóstico');

      expect(TestBed.inject(AssistantEditorController).run).toHaveBeenCalledWith('save');
    });

    it('depois de salvar, o card mostra o novo diagnóstico e libera a próxima etapa', async () => {
      const source = new FakeSource();

      source.hypothesis = null;
      const f = await setup(source);
      const assistant = TestBed.inject(AiAssistantService);

      el(f).querySelector<HTMLButtonElement>('app-empty-card button')?.click();
      await open(f);
      const inputs = assistant.activeAction()?.editor?.inputs as { saved: (text: string) => void };

      inputs.saved('Diagnóstico novo.');
      await open(f);

      expect(text(f)).toContain('Diagnóstico novo.');
      expect(text(f)).toContain('Equipe responsável');
      expect(text(f)).toContain('Avaliação clínica');
    });

    it('sem perfil carregado, o lápis não abre nada', async () => {
      const f = await setup(new FakeSource());
      const hub = f.componentInstance as unknown as { profile: { set(v: null): void }; editDiagnosis(): void };

      hub.profile.set(null);
      hub.editDiagnosis();

      expect(TestBed.inject(AiAssistantService).view()).toBe('chat');
    });
  });

  describe('layout do Figma (3 colunas) e evoluções', () => {
    let f: ComponentFixture<PatientHubComponent>;
    const el = (): HTMLElement => f.nativeElement as HTMLElement;

    beforeEach(async () => {
      f = await setup(new FakeSource());
    });

    it('mostra as seções na ordem do Figma: Diagnóstico, Prescrição, Avaliação clínica, nutricional e funcional e Evoluções', () => {
      const titles = Array.from(el().querySelectorAll('app-section-header h2')).map(h => h.textContent.trim());

      // "Metas nutricionais" só aparece quando há aporte calculado (sem meta, não há o que mostrar).
      expect(titles).toEqual([
        'Diagnóstico',
        'Metas nutricionais',
        'Prescrição ativa',
        'Avaliação clínica',
        'Avaliação nutricional e funcional',
        'Evoluções',
      ]);

      expect(el().querySelector('.hub__bed')?.textContent).toContain('Ala 2 · Leito 35');
      expect(el().querySelector('app-date-strip')).not.toBeNull();
    });

    it('o lápis da Avaliação clínica abre o editor no painel; o card ganha destaque e o lápis vira o ✓ que salva', async () => {
      const assistant = TestBed.inject(AiAssistantService);

      expect(el().querySelector('.hub__diag--editing')).toBeNull();
      await clickLabel(f, 'Editar avaliação clínica');

      expect(assistant.view()).toBe('editor');
      expect(assistant.activeAction()?.id).toBe('clinical-assessment');
      expect(el().querySelector('.hub__diag--editing')).not.toBeNull();
      expect(el().querySelector('button[aria-label="Editar avaliação clínica"]')).toBeNull();
      expect(el().querySelector('button[aria-label="Salvar avaliação clínica"]')).not.toBeNull();
    });

    it('o ✓ salva pelo editor aberto, e ao fechar o painel o lápis volta', async () => {
      const assistant = TestBed.inject(AiAssistantService);
      const run = jasmine.createSpy('run');

      await clickLabel(f, 'Editar avaliação clínica');
      TestBed.inject(AssistantEditorController).attach({ actions: signal([]), placeholder: 'M', run });
      await clickLabel(f, 'Salvar avaliação clínica');

      expect(run).toHaveBeenCalledWith('save');
      assistant.closePanel();
      f.detectChanges();

      expect(el().querySelector('button[aria-label="Editar avaliação clínica"]')).not.toBeNull();
      expect(el().querySelector('.hub__diag--editing')).toBeNull();
    });

    it('chegando do cadastro do paciente (?avaliar=1) abre a avaliação clínica uma vez e limpa o parâmetro', async () => {
      TestBed.resetTestingModule();
      const navigate = spyOn(Router.prototype, 'navigate').and.resolveTo(true);
      const g = await setup(new FakeSource(), 'p1', undefined, undefined, { avaliar: '1' });
      const assistant = TestBed.inject(AiAssistantService);

      expect(assistant.view()).toBe('editor');
      expect(assistant.activeAction()?.id).toBe('clinical-assessment');
      expect(navigate).toHaveBeenCalledWith([], {
        queryParams: { avaliar: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });

      expect(g.nativeElement).toBeTruthy();
    });

    it('sem o parâmetro, a tela abre sem o editor', () => {
      expect(TestBed.inject(AiAssistantService).view()).toBe('chat');
    });

    it('o lápis da Avaliação nutricional e funcional abre o editor no painel e destaca o card; o ✓ fecha', async () => {
      const assistant = TestBed.inject(AiAssistantService);

      expect(el().querySelector('app-nutritional-functional-tiles')).not.toBeNull();
      expect(el().querySelector('.hub__diag--editing')).toBeNull();
      el().querySelector<HTMLButtonElement>('[aria-label="Editar avaliação nutricional e funcional"]')?.click();
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();

      expect(assistant.activeAction()?.id).toBe('nutritional-functional');
      expect(el().querySelector('.hub__diag--editing')).not.toBeNull();
      expect(el().querySelector('[aria-label="Salvar avaliação nutricional e funcional"]')).not.toBeNull();
    });

    it('abrindo com ?data= de um dia anterior, o paciente fica em somente leitura: com os dados e sem botões de editar', async () => {
      TestBed.resetTestingModule();
      const g = await setup(new FakeSource(), 'p1', undefined, undefined, { data: '2026-05-20' });
      const root = g.nativeElement as HTMLElement;
      const hub = g.componentInstance as unknown as { day(): Date; readOnly(): boolean };

      expect(hub.day().getDate()).toBe(20);
      expect(hub.readOnly()).toBeTrue();
      expect(root.textContent).toContain('Insuficiência respiratória aguda.');
      expect(root.querySelectorAll('app-section-header app-icon-button').length).toBe(0);
      expect(root.textContent).not.toContain('Evoluir Paciente');
      expect(root.querySelector('app-empty-card button:not(:disabled)')).toBeNull();
    });

    for (const raw of ['lixo', '2999-01-01', '2026-13-45']) {
      it(`?data=${raw} (inválida ou futura) abre em hoje, no modo normal`, async () => {
        TestBed.resetTestingModule();
        const g = await setup(new FakeSource(), 'p1', undefined, undefined, { data: raw });
        const hub = g.componentInstance as unknown as { readOnly(): boolean };

        expect(hub.readOnly()).toBeFalse();
      });
    }

    it('voltar no tempo pela faixa de datas também leva ao modo somente leitura', async () => {
      const hub = f.componentInstance as unknown as { day: { set(d: Date): void }; readOnly(): boolean };

      expect(el().textContent).toContain('Evoluir Paciente');

      hub.day.set(new Date(2026, 4, 20));
      f.detectChanges();

      expect(hub.readOnly()).toBeTrue();
      expect(el().textContent).not.toContain('Evoluir Paciente');
    });

    it('escolher outro dia na faixa de datas passa o dia às Evoluções', async () => {
      const before = el().querySelector('app-patient-evolutions');
      const strip = f.debugElement.query(By.directive(DateStripComponent)).componentInstance as DateStripComponent;
      const day = new Date(2026, 4, 20);

      strip.dateChange.emit(day);
      f.detectChanges();
      await f.whenStable();

      expect(before).not.toBeNull();
      expect((f.componentInstance as unknown as { day(): Date }).day()).toBe(day);
    });

    it('fechar o Registro diário lê as Evoluções de novo', () => {
      const hub = f.componentInstance as unknown as { evolutionsVersion(): number; onDailyRecordClosed(): void };
      const before = hub.evolutionsVersion();

      hub.onDailyRecordClosed();

      expect(hub.evolutionsVersion()).toBe(before + 1);
    });
  });

  describe('cabeçalho do Figma (4608:4893)', () => {
    let f: ComponentFixture<PatientHubComponent>;
    const el = (): HTMLElement => f.nativeElement as HTMLElement;

    beforeEach(async () => {
      f = await setup(new FakeSource());
    });

    it('a faixa de datas flutua na linha do leito (3 dias) e há outra na coluna do paciente (mobile)', () => {
      const floating = el().querySelector('.hub__bed-row app-date-strip');
      const column = el().querySelector('.hub__group > app-date-strip');

      expect(el().querySelector('app-page-header app-date-strip')).toBeNull();
      expect(floating?.classList).toContain('date-strip--header');
      expect(column?.classList).not.toContain('date-strip--header');
    });

    it('no mobile o cabeçalho não tem o sino (só os atalhos)', async () => {
      desktop.set(false);
      f.detectChanges();

      expect(el().querySelector('.page-header__bell')).toBeNull();
      desktop.set(true);
    });

    it('mostra o sino com as não lidas e abre as notificações', async () => {
      const router = TestBed.inject(Router);
      const navigate = spyOn(router, 'navigate').and.resolveTo(true);

      await clickLabel(f, 'Notificações');

      expect(el().querySelector('app-badge')?.textContent).toContain('3');
      expect(navigate).toHaveBeenCalledWith(['/notifications']);
    });
  });
});
