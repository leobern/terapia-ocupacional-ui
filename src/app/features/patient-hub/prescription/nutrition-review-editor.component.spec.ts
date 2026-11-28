import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssistantEditorController } from '../../../shared/services/assistant-editor-controller.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfile, ProfessionalProfileReader } from '../../home/professional-profile';
import { AssessmentSource } from '../assessment/assessment-source';
import { CurrentRoute, RouteSaveRequest } from '../plan/plan.models';
import { PlanSource } from '../plan/plan-source';
import { computeTargets, NutritionTargets, ReferenceWeight, TargetsSaveRequest } from '../plan/plan-targets';
import {
  NR_KEEP_FAILED_HINT,
  NR_LOAD_FAILED_HINT,
  NR_NO_TARGETS_TEXT,
  NR_OFFLINE_HINT,
  NR_ROUTE_EMPTY_HINT,
  NR_ROUTE_SAVE_FAILED_HINT,
  NR_TARGETS_NOTHING_HINT,
  NR_TARGETS_SAVE_FAILED_HINT,
  NutritionReviewEditorComponent,
} from './nutrition-review-editor.component';
import { Prescription, PrescriptionReview, PrescriptionReviewRequest } from './prescription.models';
import { PrescriptionSource } from './prescription-source';

const PRESCRIPTION: Prescription = {
  at: '2026-11-20T13:33:00',
  author: 'Rafael Dutra',
  formulaId: 'f1',
  formulaName: 'Fresubin HP 2.0',
  kcalPerMl: 2,
  modality: 'continuous',
  nursingNotes: '',
  pauseTimes: [],
  proteinPerMl: 0.1,
  route: 'NE',
  startTime: '08:00',
  volumeMl: 900,
};
const TARGETS: NutritionTargets = computeTargets({
  calorimetry: null,
  kcalPerKg: 25,
  proteinPerKg: 1.5,
  referenceWeight: { kg: 75, kind: 'current' },
});

class FakeSource extends PrescriptionSource {
  list: readonly Prescription[] = [PRESCRIPTION];
  existing: PrescriptionReview | null = null;
  loadFails = false;
  keepFails = false;
  readonly kept: PrescriptionReviewRequest[] = [];

  load(): Promise<readonly Prescription[]> {
    return this.loadFails ? Promise.reject(new Error('x')) : Promise.resolve(this.list);
  }

  save(): Promise<readonly Prescription[]> {
    return Promise.resolve([]);
  }

  loadActive(): Promise<never[]> {
    return Promise.resolve([]);
  }

  loadReview(): Promise<PrescriptionReview | null> {
    return Promise.resolve(this.existing);
  }

  keep(request: PrescriptionReviewRequest): Promise<PrescriptionReview> {
    if (this.keepFails) {
      return Promise.reject(new Error('x'));
    }
    this.kept.push(request);

    return Promise.resolve({ at: request.at, author: request.author, day: request.day });
  }
}

describe('NutritionReviewEditorComponent', () => {
  let fixture: ComponentFixture<NutritionReviewEditorComponent>;
  let source: FakeSource;
  let targets: NutritionTargets | null;
  let route: CurrentRoute | null;
  let routeSaves: RouteSaveRequest[];
  let routeFails: boolean;
  let targetSaves: TargetsSaveRequest[];
  let targetSaveFails: boolean;
  let targetsSaved: jasmine.Spy;
  let routeSaved: jasmine.Spy;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => el().textContent.replace(/\s+/gu, ' ');
  const controller = (): AssistantEditorController => TestBed.inject(AssistantEditorController);
  const actionIds = (): string[] =>
    controller()
      .active()
      ?.actions()
      .map(a => a.id) ?? [];
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  };
  const button = (label: string): HTMLButtonElement | null =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.includes(label)) ?? null;
  const iconButton = (label: string): HTMLButtonElement | null => el().querySelector(`button[aria-label="${label}"]`);
  const type = async (name: string, value: string): Promise<void> => {
    const field = el().querySelector(`[data-input="${name}"]`) as HTMLInputElement;

    field.value = value;
    field.dispatchEvent(new Event('input'));
    await settle();
  };
  const openTargets = async (): Promise<void> => {
    button('Ajustar meta')?.click();
    await settle();
    el().querySelector<HTMLInputElement>('[data-reference="current"]')?.click();
    await settle();
  };
  const toggle = async (id: string): Promise<void> => {
    el().querySelector<HTMLInputElement>(`[data-route="${id}"]`)?.click();
    await settle();
  };

  beforeEach(async () => {
    source = new FakeSource();
    targets = TARGETS;
    route = { routes: ['NE'], since: '2026-11-01T00:00:00' };
    routeSaves = [];
    routeFails = false;
    targetSaves = [];
    targetSaveFails = false;
    targetsSaved = jasmine.createSpy('targetsSaved');
    routeSaved = jasmine.createSpy('routeSaved');
    TestBed.configureTestingModule({
      providers: [
        { provide: PrescriptionSource, useValue: source },
        {
          provide: PlanSource,
          useValue: {
            loadCalculatedWeights: (): Promise<object> => Promise.resolve({ current: 70 }),
            loadReferenceWeight: (): Promise<null> => Promise.resolve(null),
            loadRoute: (): Promise<CurrentRoute | null> => Promise.resolve(route),
            loadTargets: (): Promise<NutritionTargets | null> => Promise.resolve(targets),
            saveReferenceWeight: (r: { weight: ReferenceWeight }): Promise<ReferenceWeight> =>
              Promise.resolve(r.weight),
            saveRoute: (r: RouteSaveRequest): Promise<CurrentRoute> => {
              if (routeFails) {
                return Promise.reject(new Error('x'));
              }
              routeSaves.push(r);
              route = { routes: r.routes, since: r.at };

              return Promise.resolve(route);
            },
            saveTargets: (r: TargetsSaveRequest): Promise<NutritionTargets> => {
              if (targetSaveFails) {
                return Promise.reject(new Error('x'));
              }
              targetSaves.push(r);
              targets = r.targets;

              return Promise.resolve(r.targets);
            },
          },
        },
        { provide: AssessmentSource, useValue: { loadLatest: (): Promise<null> => Promise.resolve(null) } },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): ProfessionalProfile => ({ name: 'Dra. Ana', role: 'doctor' }) },
        },
        { provide: NOW, useValue: (): Date => new Date(2026, 10, 21, 9, 5) },
      ],
    });
    TestBed.inject(ConnectivityService).online.set(true);
  });

  const create = async (): Promise<void> => {
    fixture = TestBed.createComponent(NutritionReviewEditorComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentRef.setInput('targetsSaved', targetsSaved);
    fixture.componentRef.setInput('routeSaved', routeSaved);
    await settle();
  };

  it('começa pela meta vigente, depois via e prescrição ativa com o CTA de manter', async () => {
    await create();

    expect(text()).toContain('1.875 kcal/dia');
    expect(text()).toContain('112,5 g/dia');
    expect(text()).toContain('NE · Nutrição enteral');
    expect(text()).toContain('Fresubin HP 2.0');
    expect(text()).toContain('Rafael Dutra');
    expect(button('Manter prescrição ativa')).not.toBeNull();
    expect(actionIds()).toEqual(['targets', 'route', 'keep']);
    expect(
      el()
        .querySelector('[data-testid="targets"]')
        ?.compareDocumentPosition(el().querySelector('[data-testid="route-current"]') as Node),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('sem meta nem prescrição indica indisponível em texto', async () => {
    targets = null;
    source.list = [];
    await create();

    expect(text()).toContain(NR_NO_TARGETS_TEXT);
    expect(el().querySelector('[data-testid="no-prescription"]')).not.toBeNull();
  });

  it('falha ao carregar avisa', async () => {
    source.loadFails = true;
    await create();

    expect(text()).toContain(NR_LOAD_FAILED_HINT);
  });

  describe('meta', () => {
    it('ajusta com X e ✓: o ✓ grava com autor e data/hora e recarrega a meta', async () => {
      await create();
      await openTargets();

      expect(iconButton('Cancelar o ajuste da meta')).not.toBeNull();
      expect(actionIds()).not.toContain('targets');
      await type('kcal', '30');
      await type('protein', '2');
      iconButton('Salvar a meta')?.click();
      await settle();

      expect(targetSaves.length).toBe(1);
      expect(targetSaves[0].author).toBe('Dra. Ana');
      expect(targetSaves[0].targets.kcalPerDay).toBe(2100);
      expect(targetsSaved).toHaveBeenCalledWith();
      expect(el().querySelector('app-targets-editor')).toBeNull();
      expect(text()).toContain('2.100 kcal/dia');
    });

    it('o X cancela o ajuste sem gravar', async () => {
      await create();
      await openTargets();
      iconButton('Cancelar o ajuste da meta')?.click();
      await settle();

      expect(el().querySelector('app-targets-editor')).toBeNull();
      expect(targetSaves).toEqual([]);
    });

    it('sem alteração mostra o aviso de nada a salvar', async () => {
      await create();
      button('Ajustar meta')?.click();
      await settle();
      iconButton('Salvar a meta')?.click();
      await settle();

      expect(text()).toContain(NR_TARGETS_NOTHING_HINT);
    });

    it('falha ao gravar mantém o ajuste aberto e avisa', async () => {
      await create();
      await openTargets();
      targetSaveFails = true;
      iconButton('Salvar a meta')?.click();
      await settle();

      expect(text()).toContain(NR_TARGETS_SAVE_FAILED_HINT);
      expect(el().querySelector('app-targets-editor')).not.toBeNull();
    });

    it('offline não abre o ajuste', async () => {
      await create();
      TestBed.inject(ConnectivityService).online.set(false);
      await settle();
      (fixture.componentInstance as unknown as { startTargets(): void }).startTargets();
      await settle();

      expect(text()).toContain(NR_OFFLINE_HINT);
      expect(el().querySelector('app-targets-editor')).toBeNull();
    });
  });

  describe('via de nutrição (seleção múltipla)', () => {
    it('abre as opções, marca mais de uma via e o ✓ grava', async () => {
      await create();

      expect(el().querySelector('[data-route]')).toBeNull();
      (el().querySelector('.nr__select') as HTMLButtonElement).click();
      await settle();
      await toggle('VO');

      expect(text()).toContain('VO · Via oral, NE · Nutrição enteral');
      iconButton('Salvar a via')?.click();
      await settle();

      expect(routeSaves[0].routes).toEqual(['VO', 'NE']);
      expect(routeSaved).toHaveBeenCalledWith();
      expect(el().querySelector('[data-route]')).toBeNull();
    });

    it('o X volta à via vigente', async () => {
      await create();
      (el().querySelector('.nr__select') as HTMLButtonElement).click();
      await settle();
      await toggle('NP');
      iconButton('Cancelar a via')?.click();
      await settle();

      expect(text()).toContain('NE · Nutrição enteral');
      expect(text()).not.toContain('NP · Nutrição parenteral');
      expect(routeSaves).toEqual([]);
    });

    it('sem nenhuma via marcada pede ao menos uma; falha ao gravar avisa', async () => {
      await create();
      (el().querySelector('.nr__select') as HTMLButtonElement).click();
      await settle();
      await toggle('NE');
      iconButton('Salvar a via')?.click();
      await settle();

      expect(text()).toContain(NR_ROUTE_EMPTY_HINT);
      // Clicar fora da lista (no botão Salvar) a fecha: abre de novo para marcar a via.
      (el().querySelector('.nr__select') as HTMLButtonElement).click();
      await settle();
      await toggle('NP');
      routeFails = true;
      iconButton('Salvar a via')?.click();
      await settle();

      expect(text()).toContain(NR_ROUTE_SAVE_FAILED_HINT);
    });

    it('offline não grava a via', async () => {
      await create();
      (el().querySelector('.nr__select') as HTMLButtonElement).click();
      await settle();
      await toggle('NP');
      TestBed.inject(ConnectivityService).online.set(false);
      await (fixture.componentInstance as unknown as { saveRoute(): Promise<void> }).saveRoute();
      await settle();

      expect(text()).toContain(NR_OFFLINE_HINT);
      expect(routeSaves).toEqual([]);
    });
  });

  describe('manter prescrição ativa', () => {
    it('registra a revisão do dia e some o atalho', async () => {
      await create();
      button('Manter prescrição ativa')?.click();
      await settle();

      expect(source.kept.length).toBe(1);
      expect(source.kept[0].author).toBe('Dra. Ana');
      expect(text()).toContain('Revisada hoje por Dra. Ana');
      expect(actionIds()).toEqual(['targets', 'route']);
      expect(button('Manter prescrição ativa')?.disabled).toBe(true);
    });

    it('o atalho "Manter prescrição ativa" faz o mesmo', async () => {
      await create();
      controller().run('keep');
      await settle();

      expect(source.kept.length).toBe(1);
    });

    it('falha ao registrar avisa e nada muda', async () => {
      await create();
      source.keepFails = true;
      button('Manter prescrição ativa')?.click();
      await settle();

      expect(text()).toContain(NR_KEEP_FAILED_HINT);
      expect(button('Manter prescrição ativa')?.disabled).toBe(false);
    });

    it('já revisada hoje: botão desabilitado e texto de quem revisou', async () => {
      source.existing = { at: '2026-11-21T08:00:00', author: 'Dr. Bruno', day: '2026-11-21' };
      await create();

      expect(button('Manter prescrição ativa')?.disabled).toBe(true);
      expect(text()).toContain('Revisada hoje por Dr. Bruno');
    });
  });

  it('os atalhos Ajustar meta e Alterar via agem sobre os cards', async () => {
    await create();
    controller().run('targets');
    await settle();

    expect(el().querySelector('app-targets-editor')).not.toBeNull();
    controller().run('route');
    await settle();

    expect(el().querySelector('[data-route]')).not.toBeNull();
  });

  it('sem via definida pede para selecionar; salvar a meta sem o ajuste aberto não faz nada', async () => {
    route = null;
    await create();

    expect(text()).toContain('Selecione a via de nutrição');
    const editor = fixture.componentInstance as unknown as { saveTargets(): Promise<void>; keep(): Promise<void> };

    await editor.saveTargets();
    await editor.keep();
    await editor.keep();

    expect(targetSaves).toEqual([]);
    expect(source.kept.length).toBe(1);
  });
});
