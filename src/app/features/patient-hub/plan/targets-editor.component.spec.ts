import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NutritionFunctionalAssessment } from '../assessment/assessment.models';
import { AssessmentSource } from '../assessment/assessment-source';
import { PlanSource } from './plan-source';
import { CalculatedWeights, computeTargets, NutritionTargets, ReferenceWeight } from './plan-targets';
import { TargetsEditorComponent } from './targets-editor.component';

const META = { at: '2026-11-21T10:00:00Z', author: 'Dra. Ana', patientId: 'p1' };
const WEIGHTS: CalculatedWeights = { adjusted: 68, current: 75, dry: 72.5, ideal: 62 };

interface Harness {
  readonly fixture: ComponentFixture<TargetsEditorComponent>;
  readonly editor: TargetsEditorComponent;
}

describe('TargetsEditorComponent', () => {
  let weights: CalculatedWeights;
  let weightsFail: boolean;
  let reference: ReferenceWeight | null;
  let targets: NutritionTargets | null;
  let assessment: NutritionFunctionalAssessment | null;
  let assessmentFail: boolean;
  let referenceSaves: ReferenceWeight[];
  let targetSaves: NutritionTargets[];

  const settle = async (fixture: ComponentFixture<unknown>): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const setup = async (editable = true): Promise<Harness> => {
    const fixture = TestBed.createComponent(TargetsEditorComponent);

    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentRef.setInput('editable', editable);
    await settle(fixture);

    return { editor: fixture.componentInstance, fixture };
  };
  const call = (h: Harness, name: string, ...args: unknown[]): unknown =>
    ((h.editor as unknown as Record<string, (...a: unknown[]) => unknown>)[name] as (...a: unknown[]) => unknown).apply(
      h.editor,
      args,
    );
  const typeInto = async (h: Harness, which: string, value: string): Promise<void> => {
    call(h, 'setFactor', which, { target: { value } } as unknown as Event);
    await settle(h.fixture);
  };
  const html = (h: Harness): string => (h.fixture.nativeElement as HTMLElement).textContent;

  beforeEach(() => {
    weights = WEIGHTS;
    weightsFail = false;
    reference = null;
    targets = null;
    assessment = null;
    assessmentFail = false;
    referenceSaves = [];
    targetSaves = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PlanSource,
          useValue: {
            loadCalculatedWeights: (): Promise<CalculatedWeights> =>
              weightsFail ? Promise.reject(new Error('x')) : Promise.resolve(weights),
            loadReferenceWeight: (): Promise<ReferenceWeight | null> => Promise.resolve(reference),
            loadTargets: (): Promise<NutritionTargets | null> => Promise.resolve(targets),
            saveReferenceWeight: (r: { weight: ReferenceWeight }): Promise<ReferenceWeight> => {
              referenceSaves.push(r.weight);

              return Promise.resolve(r.weight);
            },
            saveTargets: (r: { targets: NutritionTargets }): Promise<NutritionTargets> => {
              targetSaves.push(r.targets);

              return Promise.resolve(r.targets);
            },
          },
        },
        {
          provide: AssessmentSource,
          useValue: {
            loadLatest: (): Promise<NutritionFunctionalAssessment | null> =>
              assessmentFail ? Promise.reject(new Error('x')) : Promise.resolve(assessment),
          },
        },
      ],
    });
  });

  it('sem peso escolhido não há metas nem nada a gravar', async () => {
    const h = await setup();

    expect(h.editor.currentTargets()).toBeNull();
    expect(h.editor.pending()).toEqual({ error: null, reference: null, targets: null });
  });

  it('escolher o peso calcula as metas na hora e marca peso e metas como pendentes', async () => {
    const h = await setup();
    let edited = 0;

    h.editor.edited.subscribe(() => edited++);
    call(h, 'chooseReference', 'current');
    await settle(h.fixture);

    expect(edited).toBe(1);
    expect(h.editor.currentTargets()?.kcalPerDay).toBe(1875);
    const pending = h.editor.pending();

    expect(pending.reference).toEqual({ kg: 75, kind: 'current' });
    expect(pending.targets?.proteinPerDay).toBe(112.5);
  });

  it('commit grava peso e metas e emite saved; depois não há mais nada pendente', async () => {
    const h = await setup();
    let saved = 0;

    h.editor.saved.subscribe(() => saved++);
    call(h, 'chooseReference', 'ideal');
    await h.editor.commit(META);
    await settle(h.fixture);

    expect(referenceSaves).toEqual([{ kg: 62, kind: 'ideal' }]);
    expect(targetSaves.length).toBe(1);
    expect(saved).toBe(1);
    expect(h.editor.pending()).toEqual({ error: null, reference: null, targets: null });
  });

  it('commit sem nada pendente não grava nem emite', async () => {
    const h = await setup();
    let saved = 0;

    h.editor.saved.subscribe(() => saved++);
    await h.editor.commit(META);

    expect(referenceSaves.length + targetSaves.length).toBe(0);
    expect(saved).toBe(0);
  });

  it('reabre com o peso e as metas salvos, sem regravar', async () => {
    reference = { kg: 75, kind: 'current' };
    targets = computeTargets({ calorimetry: null, kcalPerKg: 30, proteinPerKg: 1.2, referenceWeight: reference });
    const h = await setup();

    expect(h.editor.currentTargets()?.kcalPerDay).toBe(2250);
    expect(h.editor.pending()).toEqual({ error: null, reference: null, targets: null });
  });

  it('fator inválido devolve o erro e nenhuma meta', async () => {
    const h = await setup();

    call(h, 'chooseReference', 'current');
    await typeInto(h, 'kcal', 'abc');

    expect(h.editor.pending().error).toContain('fatores');
    expect(h.editor.pending().targets).toBeNull();
  });

  it('com calorimetria: usa o percentual; percentual inválido é recusado; voltar à fórmula simples usa kcal/kg', async () => {
    assessment = { previous: {}, values: { indirectCalorimetry: '1450' } } as unknown as NutritionFunctionalAssessment;
    const h = await setup();

    call(h, 'chooseReference', 'current');
    call(h, 'chooseFormula', 'indirect-calorimetry');
    await typeInto(h, 'percent', '70');

    expect(h.editor.pending().targets?.kcalPerDay).toBe(1015);

    await typeInto(h, 'percent', '500');

    expect(h.editor.pending().error).toContain('percentual');

    call(h, 'chooseFormula', 'simplified');
    await settle(h.fixture);

    expect(h.editor.pending().targets?.kcalPerDay).toBe(1875);
  });

  it('reabre exibindo a origem calorimetria salva', async () => {
    assessment = { previous: {}, values: { indirectCalorimetry: '1450' } } as unknown as NutritionFunctionalAssessment;
    reference = { kg: 75, kind: 'current' };
    targets = computeTargets({
      calorimetry: { kcal: 1450, percent: 70 },
      kcalPerKg: 25,
      proteinPerKg: 1.5,
      referenceWeight: reference,
    });
    const h = await setup();

    expect(h.editor.currentTargets()?.calorimetry?.percent).toBe(70);
    expect(h.editor.pending().targets).toBeNull();
  });

  it('falha ao ler os pesos só degrada o seletor: avisa e segue', async () => {
    weightsFail = true;
    const h = await setup();

    expect(html(h)).toContain('Não foi possível ler os pesos');
  });

  it('falha ao ler a calorimetria: avisa e segue pela fórmula simplificada', async () => {
    assessmentFail = true;
    reference = { kg: 75, kind: 'current' };
    const h = await setup();

    expect(html(h)).toContain('Não foi possível ler a calorimetria');
  });

  it('só leitura: sem controles de edição e escolher o peso é ignorado', async () => {
    reference = { kg: 75, kind: 'current' };
    const h = await setup(false);

    expect((h.fixture.nativeElement as HTMLElement).querySelector('input')).toBeNull();
    expect(html(h)).toContain('Atual');
    call(h, 'chooseReference', 'ideal');

    expect(h.editor.pending().reference).toBeNull();
  });

  it('offline: escolher o peso é recusado e nada muda', async () => {
    const h = await setup();

    TestBed.inject(ConnectivityService).online.set(false);
    call(h, 'chooseReference', 'ideal');
    await settle(h.fixture);

    expect(h.editor.pending().reference).toBeNull();
    TestBed.inject(ConnectivityService).online.set(true);
  });

  it('só leitura e sem peso salvo mostra "Sem peso de referência"', async () => {
    const h = await setup(false);

    expect(html(h)).toContain('Sem peso de referência');
  });

  it('sem pesos na Avaliação o médico vê a orientação para preenchê-la', async () => {
    weights = {};
    const h = await setup();

    expect(html(h)).toContain('preencha a Avaliação');
  });
});
