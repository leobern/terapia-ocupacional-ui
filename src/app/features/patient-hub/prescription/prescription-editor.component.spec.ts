import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import { AssistantEditorController } from '../../../shared/services/assistant-editor-controller.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { Formula } from '../../pharmacy/formulas.models';
import { FormulasApi } from '../../pharmacy/formulas-api';
import { NutritionTargetsReader } from '../plan/nutrition-targets-reader';
import { Prescription, PrescriptionSaveRequest } from './prescription.models';
import {
  NO_LAST_PRESCRIPTION_HINT,
  PRESCRIPTION_LOAD_FAILED_HINT,
  PRESCRIPTION_OFFLINE_HINT,
  PRESCRIPTION_SAVE_FAILED_HINT,
  PrescriptionEditorComponent,
} from './prescription-editor.component';
import { PrescriptionSource } from './prescription-source';

const FORMULA = {
  category: 'standard',
  fiber: false,
  id: 'f1',
  kcalPerMl: 1,
  lactose: false,
  name: 'Fórmula A',
  proteinPerMl: 0.04,
  standardized: true,
  sucrose: false,
} as unknown as Formula;

const LAST: Prescription = {
  at: '2026-05-27T10:00:00.000Z',
  author: 'Dr. X',
  formulaId: 'f1',
  formulaName: 'Fórmula A',
  kcalPerMl: 1,
  modality: 'intermittent',
  nursingNotes: 'Cabeceira elevada',
  pauseTimes: ['20:00'],
  proteinPerMl: 0.04,
  route: 'NE',
  startTime: '08:00',
  volumeMl: 1200.5,
};

class FakeSource extends PrescriptionSource {
  stored: readonly Prescription[] = [];
  saves: PrescriptionSaveRequest[] = [];
  failSave = false;
  failLoad = false;

  load(): Promise<readonly Prescription[]> {
    return this.failLoad ? Promise.reject(new Error('x')) : Promise.resolve(this.stored);
  }

  save(request: PrescriptionSaveRequest): Promise<readonly Prescription[]> {
    if (this.failSave) {
      return Promise.reject(new Error('x'));
    }
    this.saves.push(request);

    return Promise.resolve(request.prescriptions);
  }

  loadActive(): Promise<never[]> {
    return Promise.resolve([]);
  }

  loadReview(): Promise<null> {
    return Promise.resolve(null);
  }

  keep(): Promise<never> {
    return Promise.reject(new Error('x'));
  }
}

describe('PrescriptionEditorComponent', () => {
  let fixture: ComponentFixture<PrescriptionEditorComponent>;
  let source: FakeSource;
  let saved: jasmine.Spy;
  let catalogFails: boolean;
  let hasTargets: boolean;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => root().textContent.replace(/\s+/gu, ' ');
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
  };
  const fill = async (id: string, value: string, event: 'change' | 'input' = 'input'): Promise<void> => {
    const el = root().querySelector(`#${id}`) as HTMLInputElement;

    el.value = value;
    el.dispatchEvent(new Event(event));
    await settle();
  };
  const run = async (id: string): Promise<void> => {
    controller().run(id);
    await settle();
  };
  const fillValid = async (): Promise<void> => {
    await fill('rx-formula', 'Fórmula A', 'change');
    await fill('rx-volume', '1200');
    await fill('rx-start', '08:00');
  };

  beforeEach(async () => {
    source = new FakeSource();
    saved = jasmine.createSpy('saved');
    catalogFails = false;
    hasTargets = true;
    TestBed.configureTestingModule({
      providers: [
        { provide: PrescriptionSource, useValue: source },
        {
          provide: FormulasApi,
          useValue: {
            list: (): Promise<readonly Formula[]> =>
              catalogFails ? Promise.reject(new Error('x')) : Promise.resolve([FORMULA]),
          },
        },
        {
          provide: NutritionTargetsReader,
          useValue: {
            current: (): Promise<{ kcalPerDay: number; proteinPerDay: number } | null> =>
              Promise.resolve(hasTargets ? { kcalPerDay: 1800, proteinPerDay: 80 } : null),
          },
        },
        { provide: NOW, useValue: (): Date => new Date(2026, 4, 28, 12, 0) },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): { name: string; role: string } => ({ name: 'Michelle', role: 'doctor' }) },
        },
      ],
    });
    TestBed.inject(ConnectivityService).online.set(true);
  });

  const create = async (): Promise<void> => {
    fixture = TestBed.createComponent(PrescriptionEditorComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentRef.setInput('hospitalId', 1);
    fixture.componentRef.setInput('saved', saved);
    await settle();
  };

  it('mostra os cards e os atalhos "Usar a última prescrição" e "Salvar"', async () => {
    await create();

    expect(text()).toContain('Fórmula');
    expect(text()).toContain('Volume diário');
    expect(text()).toContain('Modalidade contínua: 24 h de administração.');
    expect(actionIds()).toEqual(['last', 'save']);
  });

  it('calcula o aporte ao preencher e salva a prescrição, fechando o painel', async () => {
    await create();
    const assistant = TestBed.inject(AiAssistantService);

    spyOn(assistant, 'closePanel');
    await fillValid();

    expect(text()).toContain('1.200 kcal');
    await run('save');

    expect(source.saves[0].prescriptions[0].formulaName).toBe('Fórmula A');
    expect(saved).toHaveBeenCalledWith();
    expect(assistant.closePanel).toHaveBeenCalledWith();
  });

  it('salvar incompleto mostra os erros e não grava', async () => {
    await create();
    await run('save');

    expect(source.saves).toEqual([]);
    expect(text()).toContain('Escolha uma fórmula');
  });

  it('modalidade intermitente permite horários de pausa, e voltar à contínua os remove', async () => {
    await create();
    await fill('rx-modality', 'Intermitente', 'change');

    expect(actionIds()).toEqual(['last', 'pause', 'save']);
    await run('pause');
    await fill('rx-pause-0', '20:00');

    expect((root().querySelector('#rx-pause-0') as HTMLInputElement).value).toBe('20:00');
    await run('pause');
    (root().querySelector('app-field-card app-button button') as HTMLButtonElement).click();
    await settle();

    expect(root().querySelectorAll('[id^="rx-pause-"]').length).toBe(1);
    await fill('rx-modality', 'Contínua', 'change');

    expect(root().querySelectorAll('[id^="rx-pause-"]').length).toBe(0);
  });

  it('as orientações de enfermagem entram na prescrição salva', async () => {
    await create();
    await fillValid();
    await fill('rx-notes', 'Lavar a sonda');
    await run('save');

    expect(source.saves[0].prescriptions[0].nursingNotes).toBe('Lavar a sonda');
  });

  it('"Usar a última prescrição" preenche o formulário; sem anterior avisa', async () => {
    await create();
    await run('last');

    expect(text()).toContain(NO_LAST_PRESCRIPTION_HINT);
    source.stored = [LAST];
    await run('last');

    expect((root().querySelector('#rx-volume') as HTMLInputElement).value).toBe('1200,5');
    expect((root().querySelector('#rx-start') as HTMLInputElement).value).toBe('08:00');
    expect(text()).not.toContain(NO_LAST_PRESCRIPTION_HINT);
  });

  it('falha ao ler a última prescrição avisa', async () => {
    await create();
    source.failLoad = true;
    await run('last');

    expect(text()).toContain(PRESCRIPTION_LOAD_FAILED_HINT);
  });

  it('offline não grava; falha ao gravar mantém o que foi digitado e avisa', async () => {
    await create();
    await fillValid();
    TestBed.inject(ConnectivityService).online.set(false);
    await run('save');

    expect(text()).toContain(PRESCRIPTION_OFFLINE_HINT);
    TestBed.inject(ConnectivityService).online.set(true);
    source.failSave = true;
    await run('save');

    expect(text()).toContain(PRESCRIPTION_SAVE_FAILED_HINT);
    expect((root().querySelector('#rx-volume') as HTMLInputElement).value).toBe('1200');
  });

  it('falha ao carregar o catálogo avisa', async () => {
    catalogFails = true;
    await create();

    expect(text()).toContain(PRESCRIPTION_LOAD_FAILED_HINT);
  });

  it('sem meta definida avisa que a comparação está indisponível', async () => {
    hasTargets = false;
    await create();
    await fillValid();

    expect(text()).toContain('Sem meta definida');
  });
});
