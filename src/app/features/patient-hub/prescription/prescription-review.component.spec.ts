import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { DailyAdequacy } from '../../daily-evolution/adequacy/adequacy.models';
import { NOW, ProfessionalProfile, ProfessionalProfileReader } from '../../home/professional-profile';
import { AssessmentSource } from '../assessment/assessment-source';
import { PlanSource } from '../plan/plan-source';
import { computeTargets, NutritionTargets, ReferenceWeight, TargetsSaveRequest } from '../plan/plan-targets';
import {
  ActivePrescription,
  formatOptional,
  PrescriptionReview,
  PrescriptionReviewRequest,
} from './prescription.models';
import {
  NO_PRESCRIPTION_TEXT,
  PrescriptionReviewComponent,
  REVIEW_LOAD_FAILED_HINT,
  REVIEW_OFFLINE_HINT,
  REVIEW_SAVE_FAILED_HINT,
  TARGETS_NOTHING_HINT,
  TARGETS_OFFLINE_HINT,
  TARGETS_SAVE_FAILED_HINT,
  TARGETS_UNAVAILABLE_TEXT,
} from './prescription-review.component';
import { PrescriptionSource } from './prescription-source';

const PRESCRIPTION: ActivePrescription = {
  at: '2026-11-20T13:33:00',
  author: 'Rafael Dutra',
  flowMlPerHour: 55,
  formula: 'Fresubin HP 2.0',
  hoursPerDay: 18,
  kcal: 1425,
  proteinG: 82.5,
  proteinModuleG: 20,
  role: 'Nutrólogo',
  volumeMlPerDay: 900,
};
const TARGETS = { kcalPerDay: 1875, proteinPerDay: 112.5 } as NutritionTargets;
const ADEQUACY = {
  calories: { intake: 1425, percent: 76, target: 1875 },
  protein: { intake: 82.5, percent: 73, target: 112.5 },
  status: 'available',
} as DailyAdequacy;

class FakeSource extends PrescriptionSource {
  active: ActivePrescription | null = PRESCRIPTION;
  existing: PrescriptionReview | null = null;
  loadFails = false;
  keepFails = false;
  readonly kept: PrescriptionReviewRequest[] = [];

  loadActive(): Promise<ActivePrescription | null> {
    return this.loadFails ? Promise.reject(new Error('x')) : Promise.resolve(this.active);
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

describe('PrescriptionReviewComponent', () => {
  let fixture: ComponentFixture<PrescriptionReviewComponent>;
  let source: FakeSource;
  let targets: NutritionTargets | null;
  let reference: ReferenceWeight | null;
  let targetSaveFails: boolean;
  let targetSaves: TargetsSaveRequest[];

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => el().textContent.replace(/\s+/gu, ' ');
  const keepButton = (): HTMLButtonElement | null =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.includes('Manter prescrição')) ?? null;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const setOpen = async (open: boolean): Promise<void> => {
    fixture.componentRef.setInput('open', open);
    await settle();
  };
  const setup = async (role: ProfessionalProfile['role'] = 'doctor', open = true): Promise<void> => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PrescriptionSource, useValue: source },
        {
          provide: PlanSource,
          useValue: {
            loadCalculatedWeights: (): Promise<object> => Promise.resolve({ current: 70 }),
            loadReferenceWeight: (): Promise<ReferenceWeight | null> => Promise.resolve(reference),
            loadTargets: (): Promise<NutritionTargets | null> => Promise.resolve(targets),
            saveReferenceWeight: (r: { weight: ReferenceWeight }): Promise<ReferenceWeight> => {
              reference = r.weight;

              return Promise.resolve(r.weight);
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
          useValue: { read: (): ProfessionalProfile => ({ name: 'Dra. Ana', role }) },
        },
        { provide: NOW, useValue: (): Date => new Date(2026, 10, 21, 9, 5) },
      ],
    });
    fixture = TestBed.createComponent(PrescriptionReviewComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentRef.setInput('adequacy', ADEQUACY);
    await settle();
    if (open) {
      await setOpen(true);
    }
  };

  beforeEach(() => {
    source = new FakeSource();
    targets = TARGETS;
    reference = null;
    targetSaveFails = false;
    targetSaves = [];
  });

  it('médico vê adequação, meta e prescrição ativa sem abrir formulário', async () => {
    await setup();

    expect(text()).toContain('76% da meta calórica e 73% da proteica');
    expect(text()).toContain('Fresubin HP 2.0');
    expect(text()).toContain('55 ml/h');
    expect(text()).toContain('900 ml');
    expect(text()).toContain('18 h');
    expect(text()).toContain('20 g');
    expect(text()).toContain('1.425 kcal');
    expect(text()).toContain('82,5 g');
    expect(text()).toContain('Rafael Dutra · Nutrólogo · 20/11 às 13:33');
    expect(text()).toContain('1.875 kcal/dia');
    expect(text()).toContain('112,5 g/dia');
    expect(el().querySelector('input, textarea')).toBeNull();
    expect(el().querySelector('dialog')?.open).toBe(true);
  });

  it('sem % de adequação, meta ou prescrição, abre e indica indisponível em texto', async () => {
    source.active = null;
    targets = null;
    await setup();
    fixture.componentRef.setInput('adequacy', null);
    await settle();

    expect(text()).toContain('Adequação indisponível.');
    expect(text()).toContain(NO_PRESCRIPTION_TEXT);
    expect(text()).toContain(TARGETS_UNAVAILABLE_TEXT);
    expect(keepButton()?.disabled).toBe(false);
  });

  it('adequação indisponível vinda do cálculo também aparece como texto', async () => {
    await setup();
    fixture.componentRef.setInput('adequacy', { reason: 'no-target', status: 'unavailable' });
    await settle();

    expect(text()).toContain('Adequação indisponível.');
  });

  it('prescrição com campos ausentes mostra traço', async () => {
    source.active = { ...PRESCRIPTION, flowMlPerHour: null, hoursPerDay: null, proteinModuleG: null };
    await setup();

    expect(text()).toContain('Vazão—');
    expect(formatOptional(null, 'g')).toBe('—');
  });

  it('perfil não médico não vê a decisão nem carrega dados', async () => {
    await setup('other');

    expect(keepButton()).toBeNull();
    expect(text()).not.toContain('Fresubin');
  });

  it('falha ao carregar mostra erro em texto', async () => {
    source.loadFails = true;
    await setup();

    expect(text()).toContain(REVIEW_LOAD_FAILED_HINT);
  });

  it('manter registra a revisão (autor e data/hora) sem alterar a prescrição', async () => {
    await setup();
    keepButton()?.click();
    await settle();

    expect(source.kept).toEqual([
      { at: new Date(2026, 10, 21, 9, 5).toISOString(), author: 'Dra. Ana', day: '2026-11-21', patientId: 'p1' },
    ]);

    expect(source.active).toBe(PRESCRIPTION);
    expect(text()).toContain('Revisada hoje por Dra. Ana · 21/11 às 09:05');
    expect(text()).toContain('Fresubin HP 2.0');
    expect(keepButton()?.disabled).toBe(true);
  });

  it('revisão já feita hoje aparece ao abrir e não permite repetir', async () => {
    source.existing = { at: new Date(2026, 10, 21, 8, 0).toISOString(), author: 'Dr. Beto', day: '2026-11-21' };
    await setup();

    expect(text()).toContain('Revisada hoje por Dr. Beto');
    expect(keepButton()?.disabled).toBe(true);
  });

  it('offline: ação desabilitada com a mensagem de conexão necessária', async () => {
    await setup();
    TestBed.inject(ConnectivityService).online.set(false);
    await settle();
    keepButton()?.click();
    await settle();

    expect(text()).toContain(REVIEW_OFFLINE_HINT);
    expect(keepButton()?.disabled).toBe(true);
    expect(source.kept).toEqual([]);
    expect(text()).toContain('Fresubin HP 2.0');
  });

  it('erro ao salvar: mensagem, nada registrado e a tela segue aberta', async () => {
    source.keepFails = true;
    await setup();
    keepButton()?.click();
    await settle();

    expect(text()).toContain(REVIEW_SAVE_FAILED_HINT);
    expect(text()).not.toContain('Revisada hoje');
    expect(el().querySelector('dialog')?.open).toBe(true);
    expect(keepButton()?.disabled).toBe(false);
  });

  it('fechar emite closed (botão, Esc e scrim) e fechar descarta respostas pendentes', async () => {
    await setup();
    let closed = 0;

    fixture.componentInstance.closed.subscribe(() => closed++);
    const dialog = el().querySelector('dialog') as HTMLDialogElement;

    (el().querySelector('app-icon-button button') as HTMLButtonElement).click();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    dialog.click();
    el()
      .querySelector('h2')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(closed).toBe(3);
    await setOpen(false);

    expect(dialog.open).toBe(false);
  });

  it('reabrir recarrega os dados', async () => {
    await setup();
    source.active = { ...PRESCRIPTION, formula: 'Outra fórmula' };
    await setOpen(false);
    await setOpen(true);

    expect(text()).toContain('Outra fórmula');
  });

  it('manter não faz nada se a ação for chamada sem poder (fechado)', async () => {
    await setup('doctor', false);
    await (fixture.componentInstance as unknown as { keep(): Promise<void> }).keep();

    expect(source.kept).toEqual([]);
  });

  describe('ajustar a meta (US3)', () => {
    const button = (label: string): HTMLButtonElement | null =>
      Array.from(el().querySelectorAll('button')).find(b => b.textContent.includes(label)) ?? null;
    const input = (name: string): HTMLInputElement => el().querySelector(`[data-input="${name}"]`) as HTMLInputElement;
    const type = async (name: string, value: string): Promise<void> => {
      const field = input(name);

      field.value = value;
      field.dispatchEvent(new Event('input'));
      await settle();
    };
    const openEditor = async (): Promise<void> => {
      button('Ajustar meta')?.click();
      await settle();
      el().querySelector<HTMLInputElement>('[data-reference="current"]')?.click();
      await settle();
    };

    it('oferece o mesmo mecanismo de meta do Plano, gravando com autor e data/hora', async () => {
      await setup();
      let saved = 0;

      fixture.componentInstance.targetsSaved.subscribe(() => saved++);
      await openEditor();
      await type('kcal', '30');
      await type('protein', '2');

      expect(text()).toContain('Meta calórica: 2.100 kcal/dia');
      button('Salvar meta')?.click();
      await settle();

      expect(targetSaves.length).toBe(1);
      expect(targetSaves[0].author).toBe('Dra. Ana');
      expect(targetSaves[0].patientId).toBe('p1');
      expect(targetSaves[0].at).toContain('2026-11-21');
      expect(targetSaves[0].targets.kcalPerDay).toBe(2100);
      expect(saved).toBe(1);
      expect(el().querySelector('app-targets-editor')).toBeNull();
      expect(el().querySelector('[data-testid="targets"]')?.textContent).toContain('2.100 kcal/dia');
      expect(source.kept).toEqual([]);
    });

    it('sem meta definida a revisão abre e o médico define a meta por aqui', async () => {
      targets = null;
      await setup();

      expect(el().querySelector('[data-testid="no-targets"]')).not.toBeNull();
      await openEditor();
      button('Salvar meta')?.click();
      await settle();

      expect(targetSaves.length).toBe(1);
      expect(el().querySelector('[data-testid="no-targets"]')).toBeNull();
    });

    it('cancelar fecha a edição sem gravar', async () => {
      await setup();
      await openEditor();
      button('Cancelar')?.click();
      await settle();

      expect(el().querySelector('app-targets-editor')).toBeNull();
      expect(targetSaves).toEqual([]);
    });

    it('falha ao salvar mostra erro e mantém a meta anterior', async () => {
      targetSaveFails = true;
      await setup();
      await openEditor();
      button('Salvar meta')?.click();
      await settle();

      expect(text()).toContain(TARGETS_SAVE_FAILED_HINT);
      expect(text()).toContain('1.875 kcal/dia');
      expect(el().querySelector('app-targets-editor')).not.toBeNull();
    });

    it('fator inválido bloqueia o salvar e mostra o erro de validação', async () => {
      await setup();
      await openEditor();
      await type('kcal', '0');
      button('Salvar meta')?.click();
      await settle();

      expect(targetSaves).toEqual([]);
      expect(el().querySelector('[data-testid="targets-hint"]')).not.toBeNull();
      await type('kcal', '25');

      expect(el().querySelector('[data-testid="targets-hint"]')).toBeNull();
    });

    it('sem alteração avisa que não há o que salvar', async () => {
      const saved: ReferenceWeight = { kg: 70, kind: 'current' };

      reference = saved;
      targets = computeTargets({ calorimetry: null, kcalPerKg: 25, proteinPerKg: 1.5, referenceWeight: saved });
      await setup();
      button('Ajustar meta')?.click();
      await settle();
      button('Salvar meta')?.click();
      await settle();

      expect(text()).toContain(TARGETS_NOTHING_HINT);
      expect(targetSaves).toEqual([]);
    });

    it('offline: ação indisponível com "conexão necessária"; meta vigente segue visível', async () => {
      await setup();
      TestBed.inject(ConnectivityService).online.set(false);
      await settle();

      expect(button('Ajustar meta')?.disabled).toBe(true);
      expect(text()).toContain(TARGETS_OFFLINE_HINT);
      expect(text()).toContain('1.875 kcal/dia');
      (fixture.componentInstance as unknown as { startTargets(): void }).startTargets();

      expect(el().querySelector('app-targets-editor')).toBeNull();
    });

    it('ficar offline com a edição aberta recusa salvar', async () => {
      await setup();
      await openEditor();
      TestBed.inject(ConnectivityService).online.set(false);
      await settle();
      await (fixture.componentInstance as unknown as { saveTargets(): Promise<void> }).saveTargets();
      await settle();

      expect(targetSaves).toEqual([]);
      expect(text()).toContain(TARGETS_OFFLINE_HINT);
    });

    it('perfil que não é médico não vê a ação nem o editor', async () => {
      await setup('other');

      expect(button('Ajustar meta')).toBeNull();
      await (fixture.componentInstance as unknown as { saveTargets(): Promise<void> }).saveTargets();
      (fixture.componentInstance as unknown as { startTargets(): void }).startTargets();

      expect(el().querySelector('app-targets-editor')).toBeNull();
      expect(targetSaves).toEqual([]);
    });
  });
});
