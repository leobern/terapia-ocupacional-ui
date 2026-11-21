import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfile, ProfessionalProfileReader } from '../../home/professional-profile';
import { NutritionFunctionalAssessment } from '../assessment/assessment.models';
import { AssessmentSource } from '../assessment/assessment-source';
import { CurrentRoute, RouteSaveRequest, SwallowingDecision, SwallowingSaveRequest } from './plan.models';
import {
  CALORIMETRY_FAILED_HINT,
  DYSPHAGIA_FAILED_HINT,
  DYSPHAGIA_MISSING_HINT,
  EMPTY_SELECTION_HINT,
  INVALID_FACTOR_HINT,
  INVALID_PERCENT_HINT,
  LOAD_FAILED_HINT,
  OFFLINE_HINT,
  PlanSectionComponent,
  RISK_FAILED_HINT,
  SAVE_FAILED_HINT,
  WEIGHTS_FAILED_HINT,
  WEIGHTS_MISSING_HINT,
} from './plan-section.component';
import { PlanSource } from './plan-source';
import {
  CalculatedWeights,
  NutritionTargets,
  ReferenceWeight,
  ReferenceWeightSaveRequest,
  TargetsSaveRequest,
} from './plan-targets';
import { RefeedingRisk, RefeedingRiskSource } from './refeeding-risk-source';

class FakeSource extends PlanSource {
  current: CurrentRoute | null = null;
  loadFails = false;
  saveFails = false;
  readonly saves: RouteSaveRequest[] = [];
  readonly swallowSaves: SwallowingSaveRequest[] = [];
  swallowing: SwallowingDecision | null = null;
  swallowLoadFails = false;
  swallowSaveFails = false;
  calculated: CalculatedWeights = {};
  weightsFail = false;
  reference: ReferenceWeight | null = null;
  targets: NutritionTargets | null = null;
  targetsSaveFails = false;
  readonly referenceSaves: ReferenceWeightSaveRequest[] = [];
  readonly targetSaves: TargetsSaveRequest[] = [];

  loadCalculatedWeights(): Promise<CalculatedWeights> {
    return this.weightsFail ? Promise.reject(new Error('x')) : Promise.resolve(this.calculated);
  }

  loadReferenceWeight(): Promise<ReferenceWeight | null> {
    return Promise.resolve(this.reference);
  }

  saveReferenceWeight(request: ReferenceWeightSaveRequest): Promise<ReferenceWeight> {
    this.referenceSaves.push(request);
    this.reference = request.weight;

    return Promise.resolve(request.weight);
  }

  loadTargets(): Promise<NutritionTargets | null> {
    return Promise.resolve(this.targets);
  }

  saveTargets(request: TargetsSaveRequest): Promise<NutritionTargets> {
    if (this.targetsSaveFails) {
      return Promise.reject(new Error('x'));
    }
    this.targetSaves.push(request);
    this.targets = request.targets;

    return Promise.resolve(request.targets);
  }

  loadRoute(): Promise<CurrentRoute | null> {
    return this.loadFails ? Promise.reject(new Error('x')) : Promise.resolve(this.current);
  }

  saveRoute(request: RouteSaveRequest): Promise<CurrentRoute> {
    if (this.saveFails) {
      return Promise.reject(new Error('x'));
    }
    this.saves.push(request);
    this.current = { routes: request.routes, since: request.at };

    return Promise.resolve(this.current);
  }

  loadSwallowing(): Promise<SwallowingDecision | null> {
    return this.swallowLoadFails ? Promise.reject(new Error('x')) : Promise.resolve(this.swallowing);
  }

  saveSwallowing(request: SwallowingSaveRequest): Promise<SwallowingDecision> {
    if (this.swallowSaveFails) {
      return Promise.reject(new Error('x'));
    }
    this.swallowSaves.push(request);
    this.swallowing = request.decision;

    return Promise.resolve(request.decision);
  }
}

class FakeAssessment extends AssessmentSource {
  fails = false;
  latest: NutritionFunctionalAssessment | null = null;

  loadLatest(): Promise<NutritionFunctionalAssessment | null> {
    return this.fails ? Promise.reject(new Error('x')) : Promise.resolve(this.latest);
  }
}

class FakeRisk extends RefeedingRiskSource {
  fails = false;
  risk: RefeedingRisk = { atRisk: false, targetReached: false };

  load(): Promise<RefeedingRisk> {
    return this.fails ? Promise.reject(new Error('x')) : Promise.resolve(this.risk);
  }
}

describe('PlanSectionComponent', () => {
  let assessment: FakeAssessment;
  let riskSource: FakeRisk;
  let fixture: ComponentFixture<PlanSectionComponent>;
  let source: FakeSource;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dialog = (): HTMLDialogElement => el().querySelector('dialog') as HTMLDialogElement;
  const box = (id: string): HTMLInputElement => el().querySelector(`[data-route="${id}"]`) as HTMLInputElement;
  const saveButton = (): HTMLButtonElement | null =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.includes('Salvar plano')) ?? null;
  const text = (): string => el().textContent;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const openIt = async (): Promise<void> => {
    (el().querySelector('.plan__row') as HTMLButtonElement).click();
    await settle();
  };
  const toggle = async (id: string): Promise<void> => {
    box(id).click();
    await settle();
  };
  const save = async (): Promise<void> => {
    saveButton()?.click();
    await settle();
  };
  const setup = async (role: ProfessionalProfile['role']): Promise<void> => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PlanSource, useValue: source },
        { provide: RefeedingRiskSource, useValue: riskSource },
        { provide: AssessmentSource, useValue: assessment },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): ProfessionalProfile => ({ name: 'Dra. Ana', role }) },
        },
        { provide: NOW, useValue: (): Date => new Date('2026-11-20T15:00:00Z') },
      ],
    });
    fixture = TestBed.createComponent(PlanSectionComponent);
    fixture.componentRef.setInput('patientId', 'p9');
    await settle();
  };

  beforeEach(() => {
    source = new FakeSource();
    riskSource = new FakeRisk();
    assessment = new FakeAssessment();
  });

  describe('risco de disfagia (apoio da avaliação de deglutição)', () => {
    const support = (): string =>
      (el().querySelector('[data-testid="swallowing"]') as HTMLElement).textContent.replace(/\s+/gu, ' ');

    for (const role of ['doctor', 'other'] as const) {
      it(`${role}: mostra o risco registrado na Avaliação, sem campo para digitá-lo`, async () => {
        assessment.latest = { previous: {}, values: { dysphagia: 'Risco moderado' } };
        await setup(role);
        await openIt();

        expect(support()).toContain('Risco de disfagia: moderado (Avaliação nutricional).');
        expect(
          el().querySelector('[data-testid="swallowing"] input[type="text"], [data-testid="swallowing"] textarea'),
        ).toBeNull();
      });
    }

    it('sem avaliação: informa que o risco ainda não foi registrado', async () => {
      await setup('doctor');
      await openIt();

      expect(support()).toContain(DYSPHAGIA_MISSING_HINT);
    });

    it('avaliação sem risco de disfagia preenchido: mesmo aviso, sem erro', async () => {
      assessment.latest = { previous: {}, values: { weight: '51,0' } };
      await setup('doctor');
      await openIt();

      expect(support()).toContain(DYSPHAGIA_MISSING_HINT);
    });

    it('"Sem risco" é um valor registrado', async () => {
      assessment.latest = { previous: {}, values: { dysphagia: 'Sem risco' } };
      await setup('doctor');
      await openIt();

      expect(support()).toContain('Risco de disfagia: sem risco (Avaliação nutricional).');
    });

    it('falha de leitura: aviso no campo e o resto do plano segue utilizável', async () => {
      assessment.fails = true;
      await setup('doctor');
      await openIt();

      expect(support()).toContain(DYSPHAGIA_FAILED_HINT);
      await toggle('NE');
      await save();

      expect(source.saves.length).toBe(1);
    });
  });

  describe('alerta de síndrome de realimentação', () => {
    const alert = (): HTMLElement | null => el().querySelector('[data-testid="refeeding-alert"]');

    for (const role of ['doctor', 'other'] as const) {
      it(`${role}: risco em progressão mostra o alerta em destaque, antes da via vigente`, async () => {
        riskSource.risk = { atRisk: true, targetReached: false };
        await setup(role);
        await openIt();

        expect(alert()?.textContent).toContain('avance a dieta com cautela até a meta');
        expect(alert()?.classList.contains('plan__alert--reduced')).toBe(false);
        expect(alert()?.compareDocumentPosition(el().querySelector('fieldset') as Node)).toBe(
          Node.DOCUMENT_POSITION_FOLLOWING,
        );
      });
    }

    it('sem risco: nenhum alerta', async () => {
      await setup('doctor');
      await openIt();

      expect(alert()).toBeNull();
    });

    it('meta atingida: alerta visível com relevância reduzida e dito em texto', async () => {
      riskSource.risk = { atRisk: true, targetReached: true };
      await setup('doctor');
      await openIt();

      expect(alert()?.classList.contains('plan__alert--reduced')).toBe(true);
      expect(alert()?.textContent).toContain('Meta atingida');
    });

    it('falha do motor: sem alerta, aviso discreto e o resto do plano funciona', async () => {
      riskSource.fails = true;
      await setup('doctor');
      await openIt();

      expect(alert()).toBeNull();
      expect(text()).toContain(RISK_FAILED_HINT);
      await toggle('NE');
      await save();

      expect(source.saves.length).toBe(1);
    });
  });

  describe('decisão sobre avaliação de deglutição', () => {
    const radio = (id: string): HTMLInputElement | null => el().querySelector(`[data-swallowing="${id}"]`);
    const choose = async (id: string): Promise<void> => {
      radio(id)?.click();
      await settle();
    };

    it('médico: começa vazio, escolhe "Necessária", salva e reaparece ao reabrir', async () => {
      await setup('doctor');
      await openIt();

      expect(radio('needed')?.checked).toBe(false);
      expect(radio('not-needed')?.checked).toBe(false);
      await choose('needed');
      await save();

      expect(source.swallowSaves[0]).toEqual({
        at: '2026-11-20T15:00:00.000Z',
        author: 'Dra. Ana',
        decision: 'needed',
        patientId: 'p9',
      });

      expect(source.saves).toEqual([]);
      (el().querySelector('app-icon-button') as HTMLElement).click();
      await settle();
      await openIt();

      expect(radio('needed')?.checked).toBe(true);
    });

    it('altera para "Não necessária" depois', async () => {
      source.swallowing = 'needed';
      await setup('doctor');
      await openIt();
      await choose('not-needed');
      await save();

      expect(source.swallowing).toBe('not-needed');
    });

    it('salvar a decisão não muda a via; salvar a via mantém a decisão', async () => {
      source.current = { routes: ['NE'], since: '2026-11-12T12:00:00' };
      source.swallowing = 'needed';
      await setup('doctor');
      await openIt();
      await choose('not-needed');
      await save();

      expect(source.saves).toEqual([]);
      expect(source.current.since).toBe('2026-11-12T12:00:00');
      await toggle('VO');
      await save();

      expect(source.saves[0].routes).toEqual(['VO', 'NE']);
      expect(source.swallowing).toBe('not-needed');
    });

    it('via e decisão alteradas juntas são gravadas juntas', async () => {
      await setup('doctor');
      await openIt();
      await toggle('NE');
      await choose('needed');
      await save();

      expect(source.saves.length).toBe(1);
      expect(source.swallowSaves.length).toBe(1);
    });

    it('não médico vê a decisão salva, sem opções para editar', async () => {
      source.swallowing = 'needed';
      await setup('other');
      await openIt();

      expect(el().querySelector('[data-testid="swallowing-value"]')?.textContent.trim()).toBe('Necessária');
      expect(radio('needed')).toBeNull();
    });

    it('não médico sem decisão vê texto de vazio', async () => {
      await setup('other');
      await openIt();

      expect(el().querySelector('[data-testid="swallowing-value"]')?.textContent.trim()).toBe('Sem decisão registrada');
    });

    it('não médico não escolhe por chamada direta', async () => {
      await setup('other');
      await openIt();
      (fixture.componentInstance as unknown as { chooseSwallowing(id: string): void }).chooseSwallowing('needed');

      expect(source.swallowSaves).toEqual([]);
    });

    it('offline: decisão salva visível, edição desabilitada e aviso em texto', async () => {
      source.swallowing = 'needed';
      await setup('doctor');
      TestBed.inject(ConnectivityService).online.set(false);
      await openIt();

      expect(radio('needed')?.checked).toBe(true);
      expect(radio('needed')?.disabled).toBe(true);
      expect(text()).toContain(OFFLINE_HINT);
      (fixture.componentInstance as unknown as { chooseSwallowing(id: string): void }).chooseSwallowing('not-needed');

      expect(radio('not-needed')?.checked).toBe(false);
    });

    it('falha ao salvar: aviso e seleção mantida', async () => {
      source.swallowSaveFails = true;
      await setup('doctor');
      await openIt();
      await choose('needed');
      await save();

      expect(text()).toContain(SAVE_FAILED_HINT);
      expect(radio('needed')?.checked).toBe(true);
    });

    it('falha ao ler a decisão mostra o aviso de carga', async () => {
      source.swallowLoadFails = true;
      await setup('doctor');
      await openIt();

      expect(text()).toContain(LOAD_FAILED_HINT);
    });
  });

  describe('médico', () => {
    beforeEach(() => setup('doctor'));

    it('não abre sozinho: aparece recolhido e sem ler dados', () => {
      expect(dialog().open).toBe(false);
      expect(text()).toContain('Plano de intervenção');
    });

    it('paciente sem via: nada marcado; escolhe NE, salva e vira a via vigente', async () => {
      await openIt();

      expect(dialog().open).toBe(true);
      expect(box('NE').checked).toBe(false);
      await toggle('NE');
      await save();

      expect(source.saves[0]).toEqual({
        at: '2026-11-20T15:00:00.000Z',
        author: 'Dra. Ana',
        patientId: 'p9',
        routes: ['NE'],
      });

      expect(text()).toContain('Vigente: NE');
    });

    it('reabrir mostra a mesma via e desde quando vale', async () => {
      source.current = { routes: ['NE'], since: '2026-11-12T12:00:00' };
      await openIt();

      expect(box('NE').checked).toBe(true);
      expect(text()).toContain('Desde 12/11.');
    });

    it('abrir e reavaliar (fechar e reabrir) não grava nada', async () => {
      source.current = { routes: ['NE'], since: '2026-11-12T12:00:00' };
      await openIt();
      (el().querySelector('app-icon-button') as HTMLElement).click();
      await settle();
      await openIt();

      expect(source.saves).toEqual([]);
      expect(source.current.routes).toEqual(['NE']);
    });

    it('altera a via: a nova substitui a anterior', async () => {
      source.current = { routes: ['NE'], since: '2026-11-12T12:00:00' };
      await openIt();
      await toggle('NE');
      await toggle('NP');
      await save();

      expect(source.current?.routes).toEqual(['NP']);
    });

    it('NE exclusiva com VO liberada e NE mantida vira "VO/NE"', async () => {
      source.current = { routes: ['NE'], since: '2026-11-12T12:00:00' };
      await openIt();
      await toggle('VO');
      await save();

      expect(source.saves[0].routes).toEqual(['VO', 'NE']);
      expect(text()).toContain('Vigente: VO/NE');
    });

    it('sem nenhuma via não salva e explica em texto', async () => {
      await openIt();
      await save();

      expect(source.saves).toEqual([]);
      expect(text()).toContain(EMPTY_SELECTION_HINT);
    });

    it('offline: salvar indisponível com aviso em texto', async () => {
      TestBed.inject(ConnectivityService).online.set(false);
      await openIt();
      await toggle('NE');

      expect(saveButton()?.disabled).toBe(true);
      expect(text()).toContain(OFFLINE_HINT);
      await save();

      expect(source.saves).toEqual([]);
    });

    it('offline no clique: avisa e não grava', async () => {
      await openIt();
      await toggle('NE');
      TestBed.inject(ConnectivityService).online.set(false);
      fixture.detectChanges();
      await (fixture.componentInstance as unknown as { save(): Promise<void> }).save();
      fixture.detectChanges();

      expect(source.saves).toEqual([]);
      expect(text()).toContain(OFFLINE_HINT);
    });

    it('falha ao gravar mostra mensagem e mantém a seleção', async () => {
      source.saveFails = true;
      await openIt();
      await toggle('NE');
      await save();

      expect(text()).toContain(SAVE_FAILED_HINT);
      expect(box('NE').checked).toBe(true);
    });

    it('falha ao carregar mostra mensagem e não oferece salvar', async () => {
      source.loadFails = true;
      await openIt();

      expect(text()).toContain(LOAD_FAILED_HINT);
      expect(saveButton()?.disabled).toBe(true);
    });

    it('fecha pelo scrim, pelo Esc e descarta resposta atrasada', async () => {
      await openIt();
      dialog().click();
      await settle();

      expect(dialog().open).toBe(false);

      await openIt();
      dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
      await settle();

      expect(dialog().open).toBe(false);
    });
  });

  describe('peso de referência e metas', () => {
    const all: CalculatedWeights = { adjusted: 68, current: 75, dry: 72.5, ideal: 62 };
    const ref = (kind: string): HTMLInputElement =>
      el().querySelector(`[data-reference="${kind}"]`) as HTMLInputElement;
    const field = (name: string): HTMLInputElement => el().querySelector(`[data-input="${name}"]`) as HTMLInputElement;
    const section = (id: string): string =>
      (el().querySelector(`[data-testid="${id}"]`) as HTMLElement).textContent.replace(/\s+/gu, ' ');
    const pick = async (kind: string): Promise<void> => {
      ref(kind).click();
      await settle();
    };
    const type = async (name: string, value: string): Promise<void> => {
      const input = field(name);

      input.value = value;
      input.dispatchEvent(new Event('input'));
      await settle();
    };
    const calorimetry = (): void => {
      assessment.latest = { previous: {}, values: { indirectCalorimetry: '1450' } };
    };
    const formulaRadio = (f: string): HTMLInputElement =>
      el().querySelector(`[data-formula="${f}"]`) as HTMLInputElement;

    it('mostra as quatro opções com valor e só as existentes', async () => {
      source.calculated = all;
      await setup('doctor');
      await openIt();

      expect(text()).toContain('Ideal · 62,0 kg');
      expect(text()).toContain('Ajustado · 68,0 kg');
      expect(text()).toContain('Seco · 72,5 kg');
      expect(text()).toContain('Atual · 75,0 kg');
    });

    it('omite pesos inexistentes', async () => {
      source.calculated = { current: 75 };
      await setup('doctor');
      await openIt();

      expect(ref('current')).not.toBeNull();
      expect(ref('ideal')).toBeNull();
    });

    it('sem pesos: explica e não salva peso nem metas', async () => {
      await setup('doctor');
      await openIt();

      expect(text()).toContain(WEIGHTS_MISSING_HINT);
      expect(section('targets-empty')).toContain('Selecione o peso de referência');
      await save();

      expect(source.referenceSaves).toEqual([]);
      expect(source.targetSaves).toEqual([]);
    });

    it('falha ao ler pesos: aviso e a via continua funcionando', async () => {
      source.weightsFail = true;
      await setup('doctor');
      await openIt();

      expect(text()).toContain(WEIGHTS_FAILED_HINT);
      await toggle('NE');
      await save();

      expect(source.saves.length).toBe(1);
    });

    it('escolher o peso calcula as metas na hora (75 kg × 25 e × 1,5) sem gravar', async () => {
      source.calculated = all;
      await setup('doctor');
      await openIt();
      await pick('current');

      expect(section('target-kcal')).toContain('1.875 kcal/dia (25 kcal/kg)');
      expect(section('target-protein')).toContain('112,5 g/dia (1,5 g/kg)');
      await pick('adjusted');

      expect(section('target-kcal')).toContain('1.700 kcal/dia');
      expect(source.targetSaves).toEqual([]);
    });

    it('salva peso e metas com fórmula, fatores e peso como dados de entrada; reabre selecionado', async () => {
      source.calculated = all;
      await setup('doctor');
      await openIt();
      await pick('current');
      await save();

      expect(source.referenceSaves[0].weight).toEqual({ kg: 75, kind: 'current' });
      expect(source.targetSaves[0].targets).toEqual({
        calorimetry: null,
        formula: 'simplified',
        kcalPerDay: 1875,
        kcalPerKg: 25,
        proteinPerDay: 112.5,
        proteinPerKg: 1.5,
        referenceWeight: { kg: 75, kind: 'current' },
      });
      await save();

      expect(source.targetSaves.length).toBe(1);
      (el().querySelector('.plan__header app-icon-button') as HTMLElement).click();
      await openIt();

      expect(ref('current').checked).toBe(true);
      expect(section('target-basis')).toContain('Atual · 75,0 kg');
    });

    it('salvar só a via não renova o peso de referência já salvo', async () => {
      source.calculated = all;
      source.reference = { kg: 75, kind: 'current' };
      await setup('doctor');
      await openIt();
      await toggle('VO');
      await save();

      expect(source.saves.length).toBe(1);
      expect(source.referenceSaves).toEqual([]);
    });

    it('ajusta os fatores; inválidos são recusados e não gravam', async () => {
      source.calculated = all;
      await setup('doctor');
      await openIt();
      await pick('current');
      await type('kcal', '30');
      await type('protein', '2');

      expect(section('target-kcal')).toContain('2.250 kcal/dia');
      expect(section('target-protein')).toContain('150 g/dia');
      for (const bad of ['', '0', '-3', 'abc']) {
        /* eslint-disable no-await-in-loop -- cada valor inválido é digitado e salvo em sequência */
        await type('kcal', bad);
        await save();
        /* eslint-enable no-await-in-loop */

        expect(section('targets-error')).toContain(INVALID_FACTOR_HINT);
      }

      expect(source.targetSaves).toEqual([]);
      expect(source.referenceSaves).toEqual([]);
    });

    it('falha ao salvar as metas: aviso e a edição é mantida', async () => {
      source.calculated = all;
      source.targetsSaveFails = true;
      await setup('doctor');
      await openIt();
      await pick('current');
      await save();

      expect(text()).toContain(SAVE_FAILED_HINT);
      expect(ref('current').checked).toBe(true);
    });

    it('com calorimetria: opção aparece, 70% de 1.450 = 1.015 e proteína segue por kg', async () => {
      source.calculated = all;
      calorimetry();
      await setup('doctor');
      await openIt();
      await pick('current');
      formulaRadio('indirect-calorimetry').click();
      await settle();

      expect(field('percent').value).toBe('70');
      expect(section('target-kcal')).toContain('1.015 kcal/dia');
      expect(section('target-protein')).toContain('112,5 g/dia');
      expect(section('target-basis')).toContain('70% de 1.450 kcal/dia (calorimetria indireta)');
      formulaRadio('simplified').click();
      await settle();

      expect(section('target-kcal')).toContain('1.875 kcal/dia');
      expect(source.targetSaves).toEqual([]);
    });

    it('salva a origem calorimetria com percentual e valor; reabre exibindo-os', async () => {
      source.calculated = all;
      calorimetry();
      await setup('doctor');
      await openIt();
      await pick('current');
      formulaRadio('indirect-calorimetry').click();
      await settle();
      await type('percent', '80');
      await save();

      expect(source.targetSaves[0].targets.calorimetry).toEqual({ kcal: 1450, percent: 80 });
      expect(source.targetSaves[0].targets.formula).toBe('indirect-calorimetry');
      expect(source.targetSaves[0].targets.kcalPerDay).toBe(1160);
      (el().querySelector('.plan__header app-icon-button') as HTMLElement).click();
      await openIt();

      expect(formulaRadio('indirect-calorimetry').checked).toBe(true);
      expect(field('percent').value).toBe('80');
    });

    it('percentual inválido ou acima do limite é recusado', async () => {
      source.calculated = all;
      calorimetry();
      await setup('doctor');
      await openIt();
      await pick('current');
      formulaRadio('indirect-calorimetry').click();
      await settle();
      for (const bad of ['', '0', '-1', 'x', '151']) {
        /* eslint-disable no-await-in-loop -- cada valor inválido é digitado e salvo em sequência */
        await type('percent', bad);
        await save();
        /* eslint-enable no-await-in-loop */

        expect(section('targets-error')).toContain(INVALID_PERCENT_HINT);
      }

      expect(source.targetSaves).toEqual([]);
    });

    it('sem calorimetria: sem a opção, fórmula simplificada', async () => {
      source.calculated = all;
      await setup('doctor');
      await openIt();
      await pick('current');

      expect(formulaRadio('indirect-calorimetry')).toBeNull();
    });

    it('falha ao ler a calorimetria: aviso discreto e fórmula simplificada', async () => {
      source.calculated = all;
      assessment.fails = true;
      await setup('doctor');
      await openIt();
      await pick('current');

      expect(text()).toContain(CALORIMETRY_FAILED_HINT);
      expect(section('target-kcal')).toContain('1.875');
    });

    it('calorimetria sumiu ao reabrir: metas salvas seguem como gravadas e sem regravar', async () => {
      source.calculated = all;
      source.reference = { kg: 75, kind: 'current' };
      source.targets = {
        calorimetry: { kcal: 1450, percent: 70 },
        formula: 'indirect-calorimetry',
        kcalPerDay: 1015,
        kcalPerKg: 13.5,
        proteinPerDay: 112.5,
        proteinPerKg: 1.5,
        referenceWeight: { kg: 75, kind: 'current' },
      };
      await setup('doctor');
      await openIt();

      expect(section('target-kcal')).toContain('1.015 kcal/dia');
      await toggle('VO');
      await save();

      expect(source.targetSaves).toEqual([]);
    });

    it('não médico: vê peso e metas vigentes sem controles', async () => {
      source.reference = { kg: 75, kind: 'current' };
      source.targets = {
        calorimetry: null,
        formula: 'simplified',
        kcalPerDay: 1875,
        kcalPerKg: 25,
        proteinPerDay: 112.5,
        proteinPerKg: 1.5,
        referenceWeight: { kg: 75, kind: 'current' },
      };
      await setup('other');
      await openIt();

      expect(section('reference-value')).toContain('Atual · 75,0 kg');
      expect(section('target-kcal')).toContain('1.875 kcal/dia');
      expect(el().querySelector('[data-reference], [data-input]')).toBeNull();
    });

    it('não médico sem dados: textos de vazio', async () => {
      await setup('other');
      await openIt();

      expect(section('reference-value')).toContain('Sem peso de referência');
      expect(section('targets-empty')).toContain('Sem metas definidas');
    });

    it('offline: seleção desabilitada, aviso e a visualização continua', async () => {
      source.calculated = all;
      source.reference = { kg: 75, kind: 'current' };
      await setup('doctor');
      TestBed.inject(ConnectivityService).online.set(false);
      await openIt();

      expect(ref('current').disabled).toBe(true);
      expect(ref('current').checked).toBe(true);
      expect(text()).toContain(OFFLINE_HINT);
      const c = fixture.componentInstance as unknown as { chooseReference(k: string): void };

      c.chooseReference('ideal');

      expect(ref('current').checked).toBe(true);
    });
  });

  describe('não médico', () => {
    beforeEach(() => setup('other'));

    it('vê a via vigente, sem caixas de seleção nem botão de salvar', async () => {
      source.current = { routes: ['VO', 'NE'], since: '2026-11-12T12:00:00' };
      await openIt();

      expect(el().querySelector('[data-testid="current-route"]')?.textContent.trim()).toBe('VO/NE');
      expect(box('NE')).toBeNull();
      expect(saveButton()).toBeNull();
    });

    it('sem via definida mostra texto de vazio', async () => {
      await openIt();

      expect(text()).toContain('Sem via definida');
    });

    it('não consegue alterar nem salvar por chamada direta', async () => {
      await openIt();
      const c = fixture.componentInstance as unknown as { save(): Promise<void>; toggle(id: string): void };

      c.toggle('NE');
      await c.save();

      expect(source.saves).toEqual([]);
    });
  });
});
