import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { ConnectivityService } from '../../shared/services/connectivity.service';
import { ScreenActionsService } from '../../shared/services/screen-actions.service';
import { DailyAdequacy } from '../daily-evolution/adequacy/adequacy.models';
import { DailyAdequacyService } from '../daily-evolution/adequacy/daily-adequacy.service';
import { GlimReading } from '../diagnosis/diagnosis.models';
import { DiagnosisSource } from '../diagnosis/diagnosis-source';
import { FollowUpClosureSource, FollowUpClosureWriter } from '../follow-up-closure/follow-up-closure-source';
import { ProvisionalFollowUpClosureSource } from '../follow-up-closure/provisional-follow-up-closure';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import {
  NutritionAddedCards,
  NutritionHiddenCards,
  NutritionHistorySource,
  NutritionValueWriter,
} from '../patients/nutrition-panel/nutrition-card-ports';
import { NutritionValues } from '../patients/nutrition-panel/nutrition-panel.models';
import { NutritionResultsSource } from '../patients/nutrition-panel/nutrition-results-source';
import { ProvisionalNutritionCardStore } from '../patients/nutrition-panel/provisional-nutrition-card-store';
import { FormulasApi } from '../pharmacy/formulas-api';
import { AssessmentAiStructurer } from './assessment/assessment-ai-structurer';
import { AssessmentSource } from './assessment/assessment-source';
import { AssessmentWriter } from './assessment/assessment-writer';
import { DailyEvolutionSource } from './daily-record/daily-evolution-source';
import { DailyRecordSource } from './daily-record/daily-record-source';
import { DailyRecordWriter } from './daily-record/daily-record-writer';
import { EvolutionAiStructurer } from './daily-record/evolution-ai-structurer';
import { ParameterAiStructurer } from './daily-record/parameter-ai-structurer';
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

const locationMock = { back: jasmine.createSpy('back') };

class FakeSource extends PatientHubSource {
  profile: PatientHubProfile | null = PROFILE;
  hypothesis: string | null = 'Insuficiência respiratória aguda.';
  fail = false;

  loadProfile(): Promise<PatientHubProfile | null> {
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

class FakeResults extends NutritionResultsSource {
  values: NutritionValues = {};
  fail = false;
  calls = 0;

  load(): Promise<NutritionValues> {
    this.calls++;

    return this.fail ? Promise.reject(new Error('x')) : Promise.resolve(this.values);
  }
}

class FakePriorStays extends PriorStaysSource {
  has = false;
  fail = false;
  readonly calls: string[] = [];

  hasPriorStays(patientId: string, hospitalId: string): Promise<boolean> {
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
let store = new ProvisionalNutritionCardStore();
const results = new FakeResults();
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

async function setup(
  source: FakeSource,
  id: string | null = 'p1',
  hospitals: unknown[] = [{ id: 'h', name: 'Hospital Vila Nova Star' }],
  role = 'doctor',
): Promise<ComponentFixture<PatientHubComponent>> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Location, useValue: locationMock },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(id === null ? {} : { id })) } },
      { provide: PatientHubSource, useValue: source },
      { provide: NutritionResultsSource, useValue: results },
      { provide: DailyAdequacyService, useValue: adequacy },
      { provide: NutritionHistorySource, useFactory: (): ProvisionalNutritionCardStore => store },
      { provide: NutritionValueWriter, useFactory: (): ProvisionalNutritionCardStore => store },
      { provide: NutritionAddedCards, useFactory: (): ProvisionalNutritionCardStore => store },
      { provide: NutritionHiddenCards, useFactory: (): ProvisionalNutritionCardStore => store },
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
      { provide: ParameterAiStructurer, useValue: { suggest: (): Promise<readonly never[]> => Promise.resolve([]) } },
      { provide: RefeedingRiskSource, useValue: { load: (): Promise<null> => Promise.resolve(null) } },
      { provide: AssessmentSource, useValue: { loadLatest: (): Promise<null> => Promise.resolve(null) } },
      { provide: AssessmentAiStructurer, useValue: { structure: (): Promise<object> => Promise.resolve({}) } },
      { provide: AssessmentWriter, useValue: { save: (): Promise<void> => Promise.resolve() } },
      { provide: DailyRecordSource, useValue: { loadEntries: (): Promise<[]> => Promise.resolve([]) } },
      { provide: DailyRecordWriter, useValue: { record: (): Promise<[]> => Promise.resolve([]) } },
      { provide: FormulasApi, useValue: { list: (): Promise<[]> => Promise.resolve([]) } },
      { provide: NutritionTargetsReader, useValue: { current: (): Promise<null> => Promise.resolve(null) } },
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
      {
        provide: LinkedHospitalsReader,
        useValue: { read: (): unknown[] => hospitals },
      },
    ],
  });
  const fixture = TestBed.createComponent(PatientHubComponent);

  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

const text = (f: ComponentFixture<unknown>): string => (f.nativeElement as HTMLElement).textContent ?? '';

const typeInto = (f: ComponentFixture<unknown>, id: string, value: string): void => {
  const area = (f.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>(`#${id}`) as HTMLTextAreaElement;

  area.value = value;
  area.dispatchEvent(new Event('input'));
  f.detectChanges();
};

const clickButton = async (f: ComponentFixture<unknown>, label: string): Promise<void> => {
  const root = f.nativeElement as HTMLElement;

  Array.from(root.querySelectorAll('button'))
    .find(b => b.textContent?.includes(label))
    ?.click();
  await f.whenStable();
  f.detectChanges();
};

const cards = (f: ComponentFixture<unknown>): string[] =>
  Array.from((f.nativeElement as HTMLElement).querySelectorAll('.nutrition-panel__value')).map(
    v => v.textContent?.trim() ?? '',
  );

describe('PatientHubComponent', () => {
  beforeEach(() => {
    prescriptionStore.fail = false;
    prescriptionStore.value = null;
    store = new ProvisionalNutritionCardStore();
    results.values = {};
    results.fail = false;
    results.calls = 0;
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

    expect(priorStays.calls).toEqual(['h:p1']);
    expect(text(f)).toContain('Internações anteriores');
    expect(f.nativeElement.querySelector('.stays__header').getAttribute('aria-expanded')).toBe('false');
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

      expect(actions.map(a => a.label)).toEqual(['Registro diário', 'Ajustar a prescrição', 'Revisão da prescrição']);
      expect(dialog().open).toBe(false);
      actions[0].navigate?.();
      f.detectChanges();
      await f.whenStable();

      expect(dialog().open).toBe(true);
      dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
      f.detectChanges();

      expect(dialog().open).toBe(false);
    });

    it('perfil não médico não recebe a ação "Revisão da prescrição"', async () => {
      await setup(new FakeSource(), 'p1', [{ id: 'h', name: 'Hospital Vila Nova Star' }], 'other');

      expect(
        TestBed.inject(ScreenActionsService)
          .actions()
          .map(a => a.label),
      ).toEqual(['Registro diário']);
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

    expect(text(f)).toContain('Hospital Vila Nova Star · Quinta-feira, 28 de maio');
    expect(text(f)).toContain('Ala 2 · Leito 35');
    expect(text(f)).toContain('José Raimundo Soares Neto');
    expect(text(f)).toContain('67 anos · 13/04/1959');
    expect(text(f)).toContain('Terapia há 2 dias');
    expect(text(f)).toContain('Insuficiência respiratória aguda.');
    expect((f.nativeElement as HTMLElement).querySelector('textarea:not(.input-chat__field)')).toBeNull();
  });

  it('mostra o estado vazio com o campo de colagem quando não há Hipótese', async () => {
    const source = new FakeSource();

    source.hypothesis = null;
    const f = await setup(source);

    expect(text(f)).toContain('Ainda não há hipótese diagnóstica');
    expect((f.nativeElement as HTMLElement).querySelector('textarea:not(.input-chat__field)')).not.toBeNull();
  });

  it('mostra o Painel Nutricional com os 8 cards em "Sem dados" abaixo da Hipótese (FT-004-3)', async () => {
    const f = await setup(new FakeSource());
    const values = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.nutrition-panel__value'));

    expect(values.length).toBe(8);
    expect(values.every(v => v.textContent?.trim() === 'Sem dados')).toBeTrue();
  });

  describe('% de adequação (FT-004-7, US3)', () => {
    it('Painel e resumo do Hub mostram o mesmo resultado calculado', async () => {
      adequacy.result = AVAILABLE;
      const f = await setup(new FakeSource());

      expect(cards(f)).toContain('76%');
      expect(cards(f)).toContain('73%');
      expect(text(f)).toContain('76% da meta (1.875 kcal)');
      expect(text(f)).toContain('73% da meta (112,5 g)');
    });

    it('sem meta, painel em "Sem dados" e resumo indisponível com orientação, sem percentual', async () => {
      const f = await setup(new FakeSource());

      expect(cards(f).filter(v => v === 'Sem dados').length).toBe(8);
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

      expect(cards(f)).toContain('76%');
    });
  });

  describe('resultados do painel (FT-004-3, US2)', () => {
    it('carrega ao abrir e mostra cada resultado; sem resultado o card segue em "Sem dados"', async () => {
      results.values = { glim: 'Desnutrição' } as NutritionValues;
      const f = await setup(new FakeSource());

      expect(cards(f)).toContain('Desnutrição');
      expect(cards(f).filter(v => v === 'Sem dados').length).toBe(7);
    });

    it('retomar o foco recarrega; falha mantém os valores exibidos', async () => {
      results.values = { glim: 'Desnutrição' } as NutritionValues;
      const f = await setup(new FakeSource());

      results.values = { glim: 'Sem desnutrição' } as NutritionValues;
      window.dispatchEvent(new Event('focus'));
      await f.whenStable();
      f.detectChanges();

      expect(cards(f)).toContain('Sem desnutrição');

      results.fail = true;
      window.dispatchEvent(new Event('focus'));
      await f.whenStable();
      f.detectChanges();

      expect(cards(f)).toContain('Sem desnutrição');
    });

    it('regra de visibilidade: visível recarrega; oculto não', () => {
      expect(reloadsOnVisibility('visible')).toBeTrue();
      expect(reloadsOnVisibility('hidden')).toBeFalse();
    });

    it('sem id na rota não busca resultados', async () => {
      await setup(new FakeSource(), null);

      expect(results.calls).toBe(0);
    });

    it('o tratador de visibilidade e o puxar com a página rolada percorrem os dois ramos', async () => {
      const f = await setup(new FakeSource());
      const before = results.calls;
      let state: DocumentVisibilityState = 'visible';

      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      const hub = f.componentInstance as unknown as { onVisibility(): void };

      hub.onVisibility();
      const afterVisible = results.calls;

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
      const before = results.calls;
      const el = f.nativeElement as HTMLElement;
      const touch = (type: string, y: number): TouchEvent => {
        const point = new Touch({ clientX: 0, clientY: y, identifier: 1, target: el });

        return new TouchEvent(type, { changedTouches: [point], touches: type === 'touchstart' ? [point] : [] });
      };

      el.dispatchEvent(touch('touchstart', 10));
      el.dispatchEvent(touch('touchend', 50));
      el.dispatchEvent(touch('touchend', 300));
      await f.whenStable();

      expect(results.calls).toBe(before);
    });

    it('puxar para atualizar (arrasto > 80px a partir do topo) recarrega', async () => {
      const f = await setup(new FakeSource());
      const before = results.calls;
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

      expect(results.calls).toBeGreaterThan(before);
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

      root.querySelector<HTMLButtonElement>('.assessment__row')?.click();
      await f.whenStable();
      f.detectChanges();
      Array.from(root.querySelectorAll<HTMLButtonElement>('dialog app-button button'))
        .find(b => b.textContent.includes('Salvar avaliação'))
        ?.click();
      await f.whenStable();
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

  describe('preenchimento da Hipótese', () => {
    let f: ComponentFixture<PatientHubComponent>;
    const el = (): HTMLElement => f.nativeElement as HTMLElement;
    const area = (id: string): HTMLTextAreaElement =>
      el().querySelector<HTMLTextAreaElement>(`#${id}`) as HTMLTextAreaElement;
    const type = async (id: string, value: string): Promise<void> => {
      area(id).value = value;
      area(id).dispatchEvent(new Event('input'));
      f.detectChanges();
    };
    const click = async (label: string): Promise<void> => {
      const btn = Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes(label));

      btn?.click();
      await f.whenStable();
      f.detectChanges();
    };

    beforeEach(async () => {
      synth.calls.length = 0;
      synth.result = Promise.resolve('Texto da IA');
      writer.saved.length = 0;
      writer.fail = false;
      const source = new FakeSource();

      source.hypothesis = null;
      f = await setup(source);
    });

    it('não aciona a IA com campo vazio ou só espaços e orienta a colar', async () => {
      await click('Sintetizar com IA');
      await type('paste-text', '   \n ');
      await click('Sintetizar com IA');

      expect(synth.calls).toEqual([]);
      expect(text(f)).toContain('Cole um texto do prontuário antes de sintetizar.');
    });

    it('envia o texto colado, mostra carregamento e depois o resultado marcado como gerado por IA', async () => {
      const resolvers: ((v: string) => void)[] = [];

      synth.result = new Promise<string>(r => resolvers.push(r));
      await type('paste-text', 'prontuário longo');
      await click('Sintetizar com IA');

      expect(synth.calls).toEqual(['prontuário longo']);
      expect(text(f)).toContain('Sintetizando');
      expect(area('paste-text').disabled).toBeTrue();

      resolvers[0]('Resumo da IA');
      await f.whenStable();
      f.detectChanges();

      expect(text(f)).toContain('Gerado por IA');
      expect(area('draft-text').value).toBe('Resumo da IA');
      expect(writer.saved).toEqual([]);
    });

    it('confirma o texto editado (não o da IA), sem marca de IA, e grava origem ai-edited', async () => {
      await type('paste-text', 'x');
      await click('Sintetizar com IA');
      await type('draft-text', '  Texto editado  ');
      await click('Confirmar hipótese');

      expect(writer.saved).toEqual([
        jasmine.objectContaining({ author: 'Michelle', origin: 'ai-edited', patientId: 'p1', text: 'Texto editado' }),
      ]);

      expect(text(f)).toContain('Texto editado');
      expect(text(f)).not.toContain('Gerado por IA');
      expect(el().querySelector('textarea:not(.input-chat__field)')).toBeNull();
    });

    it('confirmar sem editar grava a origem ai', async () => {
      await type('paste-text', 'x');
      await click('Sintetizar com IA');
      await click('Confirmar hipótese');

      expect(writer.saved[0].origin).toBe('ai');
    });

    it('descartar volta ao texto colado sem gravar', async () => {
      await type('paste-text', 'meu texto');
      await click('Sintetizar com IA');
      await click('Descartar');

      expect(area('paste-text').value).toBe('meu texto');
      expect(writer.saved).toEqual([]);
    });

    it('na falha da IA permite digitar e confirmar manualmente, mantendo o texto colado', async () => {
      synth.result = Promise.reject(new Error('fora do ar'));
      await type('paste-text', 'colado');
      await click('Sintetizar com IA');

      expect(text(f)).toContain('A síntese por IA falhou ou está indisponível');
      expect(text(f)).not.toContain('Gerado por IA');
      expect(area('paste-text').value).toBe('colado');

      await click('Confirmar hipótese');

      expect(text(f)).toContain('Escreva a hipótese diagnóstica antes de confirmar.');
      expect(writer.saved).toEqual([]);

      await type('draft-text', 'Digitado à mão');
      await click('Confirmar hipótese');

      expect(writer.saved[0]).toEqual(jasmine.objectContaining({ origin: 'manual', text: 'Digitado à mão' }));
      expect(text(f)).toContain('Digitado à mão');
    });

    it('na falha permite tentar a síntese de novo', async () => {
      synth.result = Promise.reject(new Error('x'));
      await type('paste-text', 'colado');
      await click('Sintetizar com IA');
      synth.result = Promise.resolve('Agora foi');
      await click('Tentar sintetizar de novo');

      expect(area('draft-text').value).toBe('Agora foi');
      expect(text(f)).toContain('Gerado por IA');
    });

    it('avisa quando a gravação falha e mantém o texto em revisão', async () => {
      writer.fail = true;
      await type('paste-text', 'x');
      await click('Sintetizar com IA');
      await click('Confirmar hipótese');

      expect(text(f)).toContain('Não foi possível gravar');
      expect(area('draft-text').value).toBe('Texto da IA');
    });

    it('offline: síntese e confirmação indisponíveis com mensagem de conexão necessária', async () => {
      await type('paste-text', 'x');
      await click('Sintetizar com IA');
      TestBed.inject(ConnectivityService).online.set(false);
      f.detectChanges();

      expect(text(f)).toContain('Conexão necessária');
      const buttons = Array.from(el().querySelectorAll('button'));

      expect(buttons.find(b => b.textContent?.includes('Confirmar'))?.disabled).toBeTrue();

      const instance = f.componentInstance as unknown as { confirm(): Promise<void>; synthesize(): Promise<void> };

      await instance.confirm();
      await instance.synthesize();

      expect(writer.saved).toEqual([]);
      expect(synth.calls.length).toBe(1);
      TestBed.inject(ConnectivityService).online.set(true);
    });
  });

  describe('modal do card (US3)', () => {
    const tile = (f: ComponentFixture<unknown>, label: string): HTMLButtonElement =>
      Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.nutrition-panel__card')).find(
        b => b.textContent?.includes(label),
      ) as HTMLButtonElement;
    const modal = (f: ComponentFixture<unknown>): HTMLDialogElement =>
      (f.nativeElement as HTMLElement).querySelector('.card-modal') as HTMLDialogElement;
    const settle = async (f: ComponentFixture<unknown>): Promise<void> => {
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();
    };
    const type = async (f: ComponentFixture<unknown>, value: string): Promise<void> => {
      const input = modal(f).querySelector('input') as HTMLInputElement;

      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle(f);
    };
    const save = async (f: ComponentFixture<unknown>): Promise<void> => {
      (modal(f).querySelector('app-button button') as HTMLButtonElement).click();
      await settle(f);
    };

    it('abre ao tocar em cada um dos 8 cards, com o nome do indicador como título', async () => {
      const f = await setup(new FakeSource());
      const labels = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.nutrition-panel__label')).map(
        e => e.textContent?.trim() ?? '',
      );

      /* eslint-disable no-await-in-loop -- cada card é aberto e fechado em sequência */
      for (const label of labels) {
        tile(f, label).click();
        await settle(f);

        expect(modal(f).open).toBe(true);
        expect(modal(f).querySelector('h2')?.textContent?.trim()).toBe(label);
        (modal(f).querySelector('app-icon-button button') as HTMLButtonElement).click();
        await settle(f);

        expect(modal(f).open).toBe(false);
      }
      /* eslint-enable no-await-in-loop */
    });

    it('card Sem dados mostra "Ainda sem valor", sem seção de histórico, com ajuda e unidade', async () => {
      const f = await setup(new FakeSource());

      tile(f, 'Peso').click();
      await settle(f);

      expect(modal(f).textContent).toContain('Ainda sem valor');
      expect(modal(f).textContent).not.toContain('Histórico desta internação');
      expect(modal(f).textContent).toContain('Novo valor (kg)');
      expect(modal(f).textContent).toContain('O valor anterior vai para o histórico.');
    });

    it('valor de outra feature mostra a origem; indicador sem unidade usa "Novo valor"', async () => {
      results.values = { glim: 'Desnutrição' } as NutritionValues;
      const f = await setup(new FakeSource());

      tile(f, 'GLIM').click();
      await settle(f);

      expect(modal(f).textContent).toContain('Valor atual · resultado de outra feature');
      expect(modal(f).querySelector('label')?.textContent?.trim()).toBe('Novo valor');
    });

    it('salvar mostra o valor na grid; reabrir mostra o anterior no histórico; audita autor e hora', async () => {
      results.values = { glim: 'Desnutrição' } as NutritionValues;
      const f = await setup(new FakeSource());

      tile(f, 'GLIM').click();
      await settle(f);
      await type(f, '  Sem desnutrição ');
      await save(f);

      expect(modal(f).open).toBe(false);
      expect(tile(f, 'GLIM').textContent).toContain('Sem desnutrição');
      expect(store.auditTrail.length).toBe(1);
      expect(store.auditTrail[0].author).toBe('Michelle');
      expect(store.auditTrail[0].indicator).toBe('glim');
      expect(store.auditTrail[0].previous?.value).toBe('Desnutrição');
      expect(store.auditTrail[0].value).toBe('Sem desnutrição');
      expect(store.auditTrail[0].at).toBe(new Date(2026, 4, 28, 12).toISOString());

      tile(f, 'GLIM').click();
      await settle(f);

      expect(modal(f).textContent).toContain('Valor atual · informado pela equipe, 28/05');
      expect(modal(f).textContent).toContain('Histórico desta internação');
      expect(modal(f).querySelector('.card-modal__entry')?.textContent).toContain('Desnutrição');
      expect(modal(f).querySelector('.card-modal__entry')?.textContent).toContain('resultado de outra feature');
    });

    it('card em Sem dados editado passa a exibir o valor, sem histórico', async () => {
      const f = await setup(new FakeSource());

      tile(f, 'Peso').click();
      await settle(f);
      await type(f, '51,0 kg');
      await save(f);

      expect(tile(f, 'Peso').textContent).toContain('51,0 kg');
      expect(store.auditTrail[0].previous).toBeNull();
      tile(f, 'Peso').click();
      await settle(f);

      expect(modal(f).textContent).not.toContain('Histórico desta internação');
    });

    it('campo vazio ou só espaços não grava e orienta a preencher', async () => {
      const f = await setup(new FakeSource());

      tile(f, 'Peso').click();
      await settle(f);
      await type(f, '   ');
      await save(f);

      expect(modal(f).open).toBe(true);
      expect(modal(f).querySelector('[role="alert"]')?.textContent).toContain('Preencha um valor');
      expect(modal(f).querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
      expect(store.auditTrail.length).toBe(0);
      expect(tile(f, 'Peso').textContent).toContain('Sem dados');

      await type(f, '5');

      expect(modal(f).querySelector('[role="alert"]')).toBeNull();
    });

    it('falha ao salvar mostra erro no campo e mantém o botão ativo', async () => {
      const f = await setup(new FakeSource());

      spyOn(store, 'save').and.rejectWith(new Error('x'));
      tile(f, 'Peso').click();
      await settle(f);
      await type(f, '50');
      await save(f);

      expect(modal(f).open).toBe(true);
      expect(modal(f).querySelector('[role="alert"]')?.textContent).toContain('Não foi possível salvar');
      expect((modal(f).querySelector('app-button button') as HTMLButtonElement).disabled).toBe(false);
      expect(tile(f, 'Peso').textContent).toContain('Sem dados');
    });

    it('offline: salvar fica indisponível com mensagem de conexão necessária', async () => {
      const f = await setup(new FakeSource());
      const conn = TestBed.inject(ConnectivityService) as unknown as { online: { set(v: boolean): void } };

      conn.online.set(false);
      tile(f, 'Peso').click();
      await settle(f);

      expect((modal(f).querySelector('app-button button') as HTMLButtonElement).disabled).toBe(true);
      expect(modal(f).textContent).toContain('Conexão necessária para salvar o valor.');
      expect(modal(f).textContent).toContain('Ainda sem valor');
    });

    it('Esc e clique no scrim fecham sem alterar nada', async () => {
      const f = await setup(new FakeSource());

      tile(f, 'Peso').click();
      await settle(f);
      modal(f).dispatchEvent(new Event('cancel', { cancelable: true }));
      await settle(f);

      expect(modal(f).open).toBe(false);
      tile(f, 'Peso').click();
      await settle(f);
      modal(f).click();
      await settle(f);

      expect(modal(f).open).toBe(false);
      expect(store.auditTrail.length).toBe(0);
    });

    it('valor manual persiste ao reabrir o Hub e novo resultado de outra feature o substitui, indo ao histórico', async () => {
      const f = await setup(new FakeSource());

      tile(f, 'GLIM').click();
      await settle(f);
      await type(f, 'Manual');
      await save(f);

      results.values = { glim: 'Novo protocolo' } as NutritionValues;
      await f.componentInstance.reloadResults();
      await settle(f);

      expect(tile(f, 'GLIM').textContent).toContain('Novo protocolo');
      expect((await store.load('p1', 'glim')).map(e => e.value)).toEqual(['Manual']);
    });
  });

  describe('atualização da Hipótese já preenchida', () => {
    let f: ComponentFixture<PatientHubComponent>;
    const el = (): HTMLElement => f.nativeElement as HTMLElement;
    const area = (id: string): HTMLTextAreaElement =>
      el().querySelector<HTMLTextAreaElement>(`#${id}`) as HTMLTextAreaElement;
    const type = (id: string, value: string): void => typeInto(f, id, value);
    const click = (label: string): Promise<void> => clickButton(f, label);

    beforeEach(async () => {
      synth.calls.length = 0;
      synth.result = Promise.resolve('Texto da IA');
      writer.saved.length = 0;
      writer.fail = false;
      f = await setup(new FakeSource());
    });

    it('mostra as ações de atualizar e o texto atual segue visível durante o fluxo', async () => {
      expect(text(f)).toContain('Atualizar com novo texto');
      expect(text(f)).toContain('Editar texto');
      await click('Atualizar com novo texto');

      expect(text(f)).toContain('Insuficiência respiratória aguda.');
      expect(text(f)).not.toContain('Ainda não há hipótese');
      expect(text(f)).not.toContain('Editar texto');
    });

    it('colar novo trecho → síntese → confirmar substitui a hipótese e grava origem ai', async () => {
      await click('Atualizar com novo texto');
      type('paste-text', 'novo trecho');
      await click('Sintetizar com IA');

      expect(text(f)).toContain('Gerado por IA');
      await click('Confirmar hipótese');

      expect(writer.saved).toEqual([
        jasmine.objectContaining({ author: 'Michelle', origin: 'ai', text: 'Texto da IA' }),
      ]);

      expect(writer.saved[0].at).toMatch(/^\d{4}-/);
      expect(text(f)).toContain('Texto da IA');
      expect(text(f)).toContain('Editar texto');
      expect(el().querySelector('textarea:not(.input-chat__field)')).toBeNull();
    });

    it('cancelar mantém a hipótese anterior sem gravar', async () => {
      await click('Atualizar com novo texto');
      await click('Cancelar');

      expect(writer.saved).toEqual([]);
      expect(text(f)).toContain('Insuficiência respiratória aguda.');
      expect(el().querySelector('textarea:not(.input-chat__field)')).toBeNull();
    });

    it('texto vazio não aciona a IA; falha da IA libera digitação manual', async () => {
      await click('Atualizar com novo texto');
      await click('Sintetizar com IA');

      expect(synth.calls).toEqual([]);
      synth.result = Promise.reject(new Error('x'));
      type('paste-text', 'abc');
      await click('Sintetizar com IA');
      type('draft-text', 'Manual');
      await click('Confirmar hipótese');

      expect(writer.saved).toEqual([jasmine.objectContaining({ origin: 'manual', text: 'Manual' })]);
    });

    it('falha ao gravar mantém a hipótese anterior e informa', async () => {
      writer.fail = true;
      await click('Editar texto');
      type('edit-text', 'Novo');
      await click('Salvar');

      expect(text(f)).toContain('Não foi possível gravar');
      await click('Cancelar');

      expect(text(f)).toContain('Insuficiência respiratória aguda.');
    });

    it('edição direta: mostra o texto atual editável e só substitui ao salvar (origem manual)', async () => {
      await click('Editar texto');

      expect(area('edit-text').value).toBe('Insuficiência respiratória aguda.');
      expect(text(f)).not.toContain('Atualizar com novo texto');
      type('edit-text', '  Pneumonia  ');

      expect(writer.saved).toEqual([]);
      await click('Salvar');

      expect(writer.saved).toEqual([
        jasmine.objectContaining({ author: 'Michelle', origin: 'manual', patientId: 'p1', text: 'Pneumonia' }),
      ]);

      expect(text(f)).toContain('Pneumonia');
      expect(el().querySelector('textarea:not(.input-chat__field)')).toBeNull();
    });

    it('edição direta: cancelar descarta; vazio não salva', async () => {
      await click('Editar texto');
      type('edit-text', '   ');
      await click('Salvar');

      expect(text(f)).toContain('Escreva a hipótese diagnóstica antes de confirmar.');
      expect(writer.saved).toEqual([]);
      await click('Cancelar');

      expect(text(f)).toContain('Insuficiência respiratória aguda.');
      expect(el().querySelector('textarea:not(.input-chat__field)')).toBeNull();
    });

    it('edição direta offline: salvar indisponível com mensagem; leitura continua', async () => {
      await click('Editar texto');
      TestBed.inject(ConnectivityService).online.set(false);
      f.detectChanges();

      expect(text(f)).toContain('Conexão necessária');
      expect(text(f)).toContain('Insuficiência respiratória aguda.');
      await (f.componentInstance as unknown as { confirm(): Promise<void> }).confirm();

      expect(writer.saved).toEqual([]);
      TestBed.inject(ConnectivityService).online.set(true);
    });

    it('a hipótese não muda sem ação explícita do profissional (FR-009)', async () => {
      await click('Editar texto');
      type('edit-text', 'rascunho não salvo');
      f.detectChanges();
      await f.whenStable();

      expect(writer.saved).toEqual([]);
      await click('Cancelar');

      expect(text(f)).toContain('Insuficiência respiratória aguda.');
    });
  });

  describe('adicionar card pelo "+" (US5)', () => {
    let f: ComponentFixture<PatientHubComponent>;
    const el = (): HTMLElement => f.nativeElement;
    const plus = (): HTMLButtonElement =>
      el().querySelector<HTMLButtonElement>('button[aria-label="Adicionar card ao painel"]') as HTMLButtonElement;
    const option = (): HTMLButtonElement | null => el().querySelector<HTMLButtonElement>('.add-sheet__option');
    const cardLabels = (): string[] =>
      Array.from(el().querySelectorAll('.nutrition-panel__label')).map(n => n.textContent?.trim() ?? '');
    const flush = async (): Promise<void> => {
      f.detectChanges();
      await f.whenStable();
      await Promise.resolve();
      f.detectChanges();
    };

    beforeEach(async () => {
      f = await setup(new FakeSource());
    });

    afterEach(() => {
      TestBed.inject(ConnectivityService).online.set(true);
    });

    it('o "+" abre a listagem com o tipo do catálogo e escolher adiciona o card em "Sem dados"', async () => {
      plus().click();
      await flush();

      expect(el().querySelector('dialog')?.open).toBe(true);
      expect(option()?.textContent).toContain('Calorimetria indireta');
      option()?.click();
      await flush();

      expect(el().querySelector('dialog')?.open).toBe(false);
      expect(cardLabels().at(-1)).toBe('Calorimetria indireta');
      expect(cardLabels().length).toBe(9);
      expect(Array.from(el().querySelectorAll('.nutrition-panel__card')).at(-1)?.textContent).toContain('Sem dados');
    });

    it('tipo já adicionado não aparece de novo; sem opções mostra mensagem de lista vazia', async () => {
      plus().click();
      await flush();
      option()?.click();
      await flush();
      plus().click();
      await flush();

      expect(option()).toBeNull();
      expect(text(f)).toContain('Todos os cards disponíveis já foram adicionados.');
    });

    it('o card adicionado persiste ao reabrir o Hub', async () => {
      plus().click();
      await flush();
      option()?.click();
      await flush();
      TestBed.resetTestingModule();
      f = await setup(new FakeSource());

      expect(cardLabels()).toContain('Calorimetria indireta');
    });

    it('offline: mostra "conexão necessária" e não adiciona', async () => {
      TestBed.inject(ConnectivityService).online.set(false);
      plus().click();
      await flush();

      expect(text(f)).toContain('Conexão necessária para adicionar um card.');
      expect(option()?.disabled).toBe(true);
      await (f.componentInstance as unknown as { addCard(t: string): Promise<void> }).addCard('indirect-calorimetry');

      expect(cardLabels().length).toBe(8);
    });

    it('erro de gravação informa o profissional e não adiciona o card', async () => {
      spyOn(store, 'add').and.rejectWith(new Error('x'));
      plus().click();
      await flush();
      option()?.click();
      await flush();

      expect(text(f)).toContain('Não foi possível adicionar o card.');
      expect(cardLabels().length).toBe(8);
    });

    it('fecha pelo botão Fechar e por Esc sem adicionar', async () => {
      plus().click();
      await flush();
      el().querySelector<HTMLButtonElement>('.add-sheet__header button')?.click();
      await flush();

      expect((el().querySelector('dialog.add-sheet') as HTMLDialogElement).open).toBe(false);
      plus().click();
      await flush();
      el()
        .querySelector('dialog.add-sheet')
        ?.dispatchEvent(new Event('cancel', { cancelable: true }));
      await flush();

      expect(cardLabels().length).toBe(8);
      expect((el().querySelector('dialog.add-sheet') as HTMLDialogElement).open).toBe(false);
    });

    it('clique no scrim fecha; clique dentro não', async () => {
      plus().click();
      await flush();
      el().querySelector<HTMLElement>('.add-sheet__title')?.click();
      await flush();

      expect((el().querySelector('dialog.add-sheet') as HTMLDialogElement).open).toBe(true);
      el().querySelector<HTMLElement>('dialog.add-sheet')?.click();
      await flush();

      expect((el().querySelector('dialog.add-sheet') as HTMLDialogElement).open).toBe(false);
    });

    it('o card adicionado abre o mesmo modal, editável com histórico (ticket 02)', async () => {
      plus().click();
      await flush();
      option()?.click();
      await flush();
      Array.from(el().querySelectorAll<HTMLButtonElement>('.nutrition-panel__card')).at(-1)?.click();
      await flush();

      expect(el().querySelector('#card-modal-title')?.textContent).toContain('Calorimetria indireta');
      expect(text(f)).toContain('Novo valor (kcal/dia)');
      const input = el().querySelector<HTMLInputElement>('#card-modal-value') as HTMLInputElement;

      input.value = '1800';
      input.dispatchEvent(new Event('input'));
      await clickButton(f, 'Salvar valor');
      await flush();

      expect(Array.from(el().querySelectorAll('.nutrition-panel__card')).at(-1)?.textContent).toContain('1800');
      expect(store.auditTrail[0].indicator).toBe('indirect-calorimetry');
    });
  });

  describe('ocultar card do painel (US6)', () => {
    let f: ComponentFixture<PatientHubComponent>;
    const el = (): HTMLElement => f.nativeElement;
    const labels = (): string[] =>
      Array.from(el().querySelectorAll('.nutrition-panel__label')).map(n => n.textContent?.trim() ?? '');
    const flush = async (): Promise<void> => {
      await f.whenStable();
      await Promise.resolve();
      f.detectChanges();
    };
    const openCardNamed = async (name: string): Promise<void> => {
      Array.from(el().querySelectorAll<HTMLButtonElement>('.nutrition-panel__card'))
        .find(b => b.textContent?.includes(name))
        ?.click();
      await flush();
    };
    const hideButton = (): HTMLButtonElement | undefined =>
      Array.from(el().querySelectorAll('dialog button')).find(b => b.textContent?.includes('Ocultar do painel')) as
        HTMLButtonElement | undefined;

    beforeEach(async () => {
      results.values = { glim: 'Desnutrição' } as NutritionValues;
      f = await setup(new FakeSource());
    });

    afterEach(() => {
      TestBed.inject(ConnectivityService).online.set(true);
    });

    it('ocultar tira o card da grid e fecha o modal, sem apagar valor nem histórico', async () => {
      await openCardNamed('GLIM');
      hideButton()?.click();
      await flush();

      expect(labels()).not.toContain('GLIM');
      expect(labels().length).toBe(7);
      expect(el().querySelector<HTMLDialogElement>('.card-modal')?.open).toBe(false);
      expect(await store.loadHidden('p1')).toEqual(['glim']);
      expect(store.auditTrail.length).toBe(0);
    });

    it('resultado novo de outra feature atualiza o dado por baixo sem reaparecer na grid', async () => {
      await openCardNamed('GLIM');
      hideButton()?.click();
      await flush();
      results.values = { glim: 'Sem desnutrição' } as NutritionValues;
      await f.componentInstance.reloadResults();
      await flush();

      expect(labels()).not.toContain('GLIM');
      expect((f.componentInstance as unknown as { values(): NutritionValues }).values().glim).toBe('Sem desnutrição');
    });

    it('tipo do catálogo oculto continua contando como presente e não volta ao "+"', async () => {
      el().querySelector<HTMLButtonElement>('button[aria-label="Adicionar card ao painel"]')?.click();
      await flush();
      el().querySelector<HTMLButtonElement>('app-nutrition-add-card-sheet .add-sheet__option')?.click();
      await flush();
      await openCardNamed('Calorimetria indireta');
      hideButton()?.click();
      await flush();
      el().querySelector<HTMLButtonElement>('button[aria-label="Adicionar card ao painel"]')?.click();
      await flush();

      expect(labels()).not.toContain('Calorimetria indireta');
      expect(el().querySelector('app-nutrition-add-card-sheet .add-sheet__option')).toBeNull();
    });

    it('offline: ocultar fica desabilitado com a mensagem de conexão necessária', async () => {
      TestBed.inject(ConnectivityService).online.set(false);
      await openCardNamed('GLIM');

      expect(hideButton()?.disabled).toBe(true);

      expect(el().textContent).toContain('Conexão necessária para ocultar o card.');
      expect(labels()).toContain('GLIM');
    });

    it('erro de gravação mostra mensagem e o card continua visível', async () => {
      spyOn(store, 'setHidden').and.rejectWith(new Error('x'));
      await openCardNamed('GLIM');
      hideButton()?.click();
      await flush();

      expect(el().textContent).toContain('Não foi possível ocultar o card. Tente novamente.');
      expect(labels()).toContain('GLIM');
      expect(el().querySelector<HTMLDialogElement>('.card-modal')?.open).toBe(true);
    });

    it('ao reabrir o Hub, os cards ocultos seguem fora da grid', async () => {
      await store.setHidden('p1', 'weight', true);
      TestBed.resetTestingModule();
      f = await setup(new FakeSource());

      expect(labels()).not.toContain('Peso');
    });
  });

  describe('reexibir cards ocultos (US6, FR-021)', () => {
    let f: ComponentFixture<PatientHubComponent>;
    const el = (): HTMLElement => f.nativeElement;
    const labels = (): string[] =>
      Array.from(el().querySelectorAll('.nutrition-panel__label')).map(n => n.textContent?.trim() ?? '');
    const access = (): HTMLButtonElement | null => el().querySelector('.nutrition-panel__hidden');
    const sheetOption = (): HTMLButtonElement | null =>
      el().querySelector('app-nutrition-hidden-cards-sheet button.add-sheet__option');
    const settle = async (): Promise<void> => {
      await f.whenStable();
      f.detectChanges();
      await Promise.resolve();
      f.detectChanges();
    };

    beforeEach(async () => {
      results.values = { glim: 'Desnutrição' } as NutritionValues;
      await store.setHidden('p1', 'glim', true);
      f = await setup(new FakeSource());
    });

    afterEach(() => {
      TestBed.inject(ConnectivityService).online.set(true);
    });

    it('com card oculto mostra o acesso e a lista identifica o card por texto', async () => {
      expect(access()?.textContent).toContain('Cards ocultos (1)');
      access()?.click();
      await settle();

      expect(sheetOption()?.textContent).toContain('GLIM');
    });

    it('sem card oculto o acesso não aparece', async () => {
      await store.setHidden('p1', 'glim', false);
      await f.componentInstance.reloadResults();
      f.detectChanges();

      expect(access()).toBeNull();
    });

    it('card oculto não pode ser aberto (não está na grid)', () => {
      const panelCards = Array.from(el().querySelectorAll('.nutrition-panel__card'));

      expect(panelCards.some(c => c.textContent?.includes('GLIM'))).toBe(false);
    });

    it('escolher o card o devolve à grid com valor e histórico íntegros', async () => {
      access()?.click();
      await settle();
      sheetOption()?.click();
      await settle();

      expect(labels()).toContain('GLIM');
      expect(
        Array.from(el().querySelectorAll('.nutrition-panel__card')).find(c => c.textContent?.includes('GLIM'))
          ?.textContent,
      ).toContain('Desnutrição');

      expect(access()).toBeNull();
      expect(await store.loadHidden('p1')).toEqual([]);
    });

    it('resultado novo recebido enquanto oculto aparece ao reexibir', async () => {
      results.values = { glim: 'Sem desnutrição' } as NutritionValues;
      await f.componentInstance.reloadResults();
      access()?.click();
      await settle();
      sheetOption()?.click();
      await settle();

      expect(el().textContent).toContain('Sem desnutrição');
    });

    it('offline: reexibir fica desabilitado com a mensagem de conexão necessária', async () => {
      TestBed.inject(ConnectivityService).online.set(false);
      access()?.click();
      await settle();

      expect(sheetOption()?.disabled).toBe(true);
      expect(el().textContent).toContain('Conexão necessária para reexibir um card.');
      await (f.componentInstance as unknown as { showCard(i: string): Promise<void> }).showCard('glim');

      expect(await store.loadHidden('p1')).toEqual(['glim']);
    });

    it('erro de gravação mostra mensagem e o card segue oculto', async () => {
      spyOn(store, 'setHidden').and.rejectWith(new Error('x'));
      access()?.click();
      await settle();
      sheetOption()?.click();
      await settle();

      expect(el().textContent).toContain('Não foi possível reexibir o card. Tente novamente.');
      expect(labels()).not.toContain('GLIM');
    });

    it('fechar a lista pelo botão e pelo Esc a esconde', async () => {
      access()?.click();
      await settle();
      const dialog = el().querySelector<HTMLDialogElement>(
        'app-nutrition-hidden-cards-sheet dialog',
      ) as HTMLDialogElement;

      expect(dialog.open).toBe(true);
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      await settle();

      expect(dialog.open).toBe(false);
    });
  });
});
