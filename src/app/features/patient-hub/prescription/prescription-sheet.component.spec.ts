import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { Formula } from '../../pharmacy/formulas.models';
import { FormulasApi } from '../../pharmacy/formulas-api';
import { NutritionTargetsReader } from '../plan/nutrition-targets-reader';
import {
  ActivePrescription,
  Prescription,
  PrescriptionReview,
  PrescriptionReviewRequest,
  PrescriptionSaveRequest,
} from './prescription.models';
import { PrescriptionSheetComponent } from './prescription-sheet.component';
import { PrescriptionSource } from './prescription-source';

const base = { fiber: false, gluten: false, lactose: false, sucrose: false, vegan: false, vegetarian: false };
const CATALOG: readonly Formula[] = [
  { ...base, category: 'enteral', id: 'a', kcalPerMl: 1.5, name: 'Hiper', proteinPerMl: 0.06, standardized: true },
  {
    ...base,
    category: 'enteral',
    id: 'b',
    kcalPerMl: 1,
    name: 'Fora do hospital',
    proteinPerMl: 0.04,
    standardized: false,
  },
  {
    ...base,
    category: 'parenteral',
    id: 'c',
    kcalPerMl: null,
    name: 'Sem densidade',
    proteinPerMl: null,
    standardized: true,
  },
];

class FakeCatalog extends FormulasApi {
  fail = false;
  list(): Promise<readonly Formula[]> {
    return this.fail ? Promise.reject(new Error('x')) : Promise.resolve(CATALOG);
  }
  setStandardized(): Promise<void> {
    return Promise.resolve();
  }
  requestFormula(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeSource extends PrescriptionSource {
  saved: PrescriptionSaveRequest[] = [];
  fail = false;
  load(): Promise<readonly Prescription[]> {
    return Promise.resolve([]);
  }
  save(request: PrescriptionSaveRequest): Promise<readonly Prescription[]> {
    if (this.fail) {
      return Promise.reject(new Error('x'));
    }
    this.saved.push(request);

    return Promise.resolve(request.prescriptions);
  }
  loadActive(): Promise<readonly ActivePrescription[]> {
    return Promise.resolve([]);
  }
  loadReview(): Promise<PrescriptionReview | null> {
    return Promise.resolve(null);
  }
  keep(request: PrescriptionReviewRequest): Promise<PrescriptionReview> {
    return Promise.resolve({ at: request.at, author: request.author, day: request.day });
  }
}

const online = { value: true };
let targets: { kcalPerDay: number; proteinPerDay: number } | null = { kcalPerDay: 1800, proteinPerDay: 90 };

async function setup(): Promise<{
  f: ComponentFixture<PrescriptionSheetComponent>;
  src: FakeSource;
  cat: FakeCatalog;
}> {
  const src = new FakeSource();
  const cat = new FakeCatalog();

  TestBed.configureTestingModule({
    providers: [
      { provide: FormulasApi, useValue: cat },
      { provide: PrescriptionSource, useValue: src },
      { provide: NutritionTargetsReader, useValue: { current: (): Promise<unknown> => Promise.resolve(targets) } },
      { provide: ProfessionalProfileReader, useValue: { read: (): object => ({ name: 'Dra. Ana', role: 'doctor' }) } },
      { provide: NOW, useValue: (): Date => new Date('2026-11-21T10:00:00Z') },
      { provide: ConnectivityService, useValue: { online: (): boolean => online.value } },
    ],
  });
  const f = TestBed.createComponent(PrescriptionSheetComponent);

  f.componentRef.setInput('patientId', 'p1');
  f.componentRef.setInput('hospitalId', 'h1');
  f.componentRef.setInput('open', true);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();

  return { cat, f, src };
}

const el = (f: ComponentFixture<unknown>): HTMLElement => f.nativeElement as HTMLElement;
const field = <T extends HTMLElement>(f: ComponentFixture<unknown>, id: string): T =>
  el(f).querySelector<T>(`#${id}`) as T;
const type = (f: ComponentFixture<unknown>, node: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
  node.value = value;
  node.dispatchEvent(new Event('input'));
  f.detectChanges();
};
const choose = (f: ComponentFixture<unknown>, id: string, value: string): void => {
  const select = field<HTMLSelectElement>(f, id);

  select.value = value;
  select.dispatchEvent(new Event('change'));
  f.detectChanges();
};
const saveButton = (f: ComponentFixture<unknown>): HTMLButtonElement =>
  el(f).querySelector('.rx__save button') as HTMLButtonElement;
const intake = (f: ComponentFixture<unknown>): string =>
  el(f).querySelector('[data-testid="rx-intake"]')?.textContent ?? '';

describe('PrescriptionSheetComponent', () => {
  beforeEach(() => {
    online.value = true;
    targets = { kcalPerDay: 1800, proteinPerDay: 90 };
  });

  it('lista só as fórmulas padronizadas do hospital e carrega a densidade ao escolher', async () => {
    const { f } = await setup();
    const names = Array.from(field<HTMLSelectElement>(f, 'rx-formula').options).map(o => o.textContent?.trim());

    expect(names).toEqual(['Escolha uma fórmula', 'Hiper', 'Sem densidade']);
    choose(f, 'rx-formula', 'a');

    expect(el(f).querySelector('[data-testid="rx-density"]')?.textContent).toContain('1.5 kcal/mL');
  });

  it('atualiza o aporte e o percentual da meta ao digitar o volume (contínua, 24h)', async () => {
    const { f } = await setup();

    choose(f, 'rx-formula', 'a');
    type(f, field(f, 'rx-start'), '08:00');
    type(f, field(f, 'rx-volume'), '1200');

    expect(intake(f)).toContain('1.800 kcal (100% da meta)');
    expect(intake(f)).toContain('72 g de proteína (80% da meta)');
    expect(intake(f)).toContain('50 mL/h em 24 h');
    type(f, field(f, 'rx-volume'), '600');

    expect(intake(f)).toContain('900 kcal (50% da meta)');
  });

  it('sem meta, a comparação fica indisponível com texto e sem erro', async () => {
    targets = null;
    const { f } = await setup();

    choose(f, 'rx-formula', 'a');
    type(f, field(f, 'rx-start'), '08:00');
    type(f, field(f, 'rx-volume'), '1200');

    expect(intake(f)).toContain('meta indisponível');
    expect(el(f).querySelector('[data-testid="rx-no-target"]')).not.toBeNull();
  });

  it('banner mostra a adequação atual ou a indisponibilidade', async () => {
    const { f } = await setup();

    expect(el(f).textContent).toContain('Adequação atual indisponível.');
    f.componentRef.setInput('adequacy', {
      calories: { intake: 1, percent: 82, target: 1 },
      protein: { intake: 1, percent: 74, target: 1 },
      sources: { food: null, infusion: null },
      status: 'available',
      targets: {},
    });
    f.detectChanges();

    expect(el(f).textContent).toContain('82% da meta calórica e 74% da proteica');
  });

  it('modalidade intermitente exige pausa, usa as horas administradas e permite adicionar/remover', async () => {
    const { f } = await setup();

    choose(f, 'rx-formula', 'a');
    type(f, field(f, 'rx-start'), '08:00');
    type(f, field(f, 'rx-volume'), '1200');
    choose(f, 'rx-modality', 'intermittent');
    const add = (): void =>
      (
        Array.from(el(f).querySelectorAll('button')).find(b =>
          b.textContent?.includes('Adicionar horário'),
        ) as HTMLButtonElement
      ).click();

    expect(el(f).querySelector('[data-testid="rx-pause-error"]')?.textContent).toContain(
      'ao menos um horário de pausa',
    );
    add();
    f.detectChanges();

    expect(el(f).querySelector('[data-testid="rx-pause-error"]')?.textContent).toContain(
      'ao menos um horário de pausa',
    );

    expect(saveButton(f).disabled).toBe(true);
    type(f, el(f).querySelector('input[aria-label="Horário de pausa 1"]') as HTMLInputElement, '07:00');

    expect(el(f).querySelector('[data-testid="rx-pause-error"]')?.textContent).toContain('depois do horário de início');
    type(f, el(f).querySelector('input[aria-label="Horário de pausa 1"]') as HTMLInputElement, '20:00');

    expect(intake(f)).toContain('100 mL/h em 12 h');
    expect(saveButton(f).disabled).toBe(false);
    (el(f).querySelector('[aria-label="Remover pausa 1"]') as HTMLElement).click();
    f.detectChanges();

    expect(el(f).querySelectorAll('input[type="time"]').length).toBe(1);
    choose(f, 'rx-modality', 'continuous');

    expect(el(f).textContent).toContain('24 h de administração');
  });

  it('salvar grava a prescrição com orientações e autor, fecha e avisa', async () => {
    const { f, src } = await setup();
    let saved = 0;
    let closed = 0;

    f.componentInstance.saved.subscribe(() => saved++);
    f.componentInstance.closed.subscribe(() => closed++);
    choose(f, 'rx-formula', 'a');
    type(f, field(f, 'rx-start'), '08:00');
    type(f, field(f, 'rx-volume'), '1200');
    type(f, field(f, 'rx-notes'), ' não desconectar a bolsa ');
    saveButton(f).click();
    await f.whenStable();

    expect(src.saved[0].prescriptions[0]).toEqual(
      jasmine.objectContaining({
        author: 'Dra. Ana',
        formulaId: 'a',
        nursingNotes: 'não desconectar a bolsa',
        volumeMl: 1200,
      }),
    );

    expect([saved, closed]).toEqual([1, 1]);
  });

  it('salvar inválido mostra os erros em texto e não grava', async () => {
    const { f, src } = await setup();

    (f.componentInstance as unknown as { save: () => Promise<void> }).save();
    await f.whenStable();
    f.detectChanges();

    expect(src.saved).toEqual([]);
    expect(el(f).textContent).toContain('Escolha uma fórmula do catálogo.');
    expect(el(f).textContent).toContain('Informe um volume maior que zero.');
    expect(el(f).textContent).toContain('Informe o horário previsto de início.');
  });

  it('falha de gravação mantém o formulário e o que foi digitado', async () => {
    const { f, src } = await setup();

    src.fail = true;
    choose(f, 'rx-formula', 'a');
    type(f, field(f, 'rx-start'), '08:00');
    type(f, field(f, 'rx-volume'), '1200');
    saveButton(f).click();
    await f.whenStable();
    f.detectChanges();

    expect(el(f).textContent).toContain('Não foi possível salvar a prescrição');
    expect(field<HTMLInputElement>(f, 'rx-volume').value).toBe('1200');
    expect(saveButton(f).disabled).toBe(false);
  });

  it('offline informa conexão necessária, bloqueia a edição e não salva', async () => {
    online.value = false;
    const { f, src } = await setup();

    expect(el(f).querySelector('[data-testid="rx-offline"]')?.textContent).toContain('Conexão necessária');
    expect(el(f).querySelector('fieldset')?.disabled).toBe(true);
    expect(saveButton(f).disabled).toBe(true);
    await (f.componentInstance as unknown as { save: () => Promise<void> }).save();

    expect(src.saved).toEqual([]);
  });

  it('falha ao carregar o catálogo avisa e impede salvar', async () => {
    const { f, cat } = await (async (): Promise<Awaited<ReturnType<typeof setup>>> => {
      const r = await setup();

      return r;
    })();

    cat.fail = true;
    f.componentRef.setInput('open', false);
    f.detectChanges();
    f.componentRef.setInput('open', true);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();

    expect(el(f).textContent).toContain('Não foi possível carregar as fórmulas');
    expect(saveButton(f).disabled).toBe(true);
  });

  it('fechar pelo botão, backdrop e Esc emite closed', async () => {
    const { f } = await setup();
    let closed = 0;

    f.componentInstance.closed.subscribe(() => closed++);
    (el(f).querySelector('app-icon-button') as HTMLElement).click();
    el(f).querySelector('dialog')?.click();
    el(f)
      .querySelector('dialog')
      ?.dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(closed).toBe(3);
    el(f)
      .querySelector('.rx__body')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(closed).toBe(3);
  });
});
