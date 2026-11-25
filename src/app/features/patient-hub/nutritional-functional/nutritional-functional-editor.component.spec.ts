import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import { AssistantEditorController } from '../../../shared/services/assistant-editor-controller.service';
import { AssessmentValues, NutritionFunctionalAssessment } from '../assessment/assessment.models';
import { AssessmentSource } from '../assessment/assessment-source';
import { AssessmentWriter } from '../assessment/assessment-writer';
import { ClinicalAssessment } from '../clinical-assessment/clinical-assessment.models';
import { ClinicalAssessmentSource } from '../clinical-assessment/clinical-assessment-source';
import { NutritionalFunctionalEditorComponent } from './nutritional-functional-editor.component';

class FakeSource extends AssessmentSource {
  fails = false;
  latest: NutritionFunctionalAssessment | null = {
    previous: { handgrip: { at: '2026-05-20T10:00:00', value: '12' } },
    values: { handgrip: '14' },
  };

  loadLatest(): Promise<NutritionFunctionalAssessment | null> {
    return this.fails ? Promise.reject(new Error('x')) : Promise.resolve(this.latest);
  }
}

class FakeWriter extends AssessmentWriter {
  fails = false;
  readonly saved: AssessmentValues[] = [];

  save(_: string, values: AssessmentValues): Promise<void> {
    if (this.fails) {
      return Promise.reject(new Error('x'));
    }
    this.saved.push(values);

    return Promise.resolve();
  }
}

class FakeClinical extends ClinicalAssessmentSource {
  weight: number | null = 50;
  fails = false;

  load(): Promise<ClinicalAssessment> {
    return this.fails
      ? Promise.reject(new Error('x'))
      : Promise.resolve({ device: '', heightCm: null, items: [], tnType: '', weightKg: this.weight });
  }

  save(): Promise<void> {
    return Promise.resolve();
  }
}

describe('NutritionalFunctionalEditorComponent', () => {
  let fixture: ComponentFixture<NutritionalFunctionalEditorComponent>;
  let source: FakeSource;
  let writer: FakeWriter;
  let clinical: FakeClinical;
  let saved: jasmine.Spy;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => root().textContent.replace(/\s+/gu, ' ');
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const create = async (): Promise<void> => {
    fixture = TestBed.createComponent(NutritionalFunctionalEditorComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentRef.setInput('saved', saved);
    await settle();
  };
  const type = async (selector: string, value: string): Promise<void> => {
    const el = root().querySelector(selector) as HTMLInputElement;

    el.value = value;
    el.dispatchEvent(new Event('input'));
    await settle();
  };
  const choose = async (selector: string, value: string): Promise<void> => {
    const el = root().querySelector(selector) as HTMLSelectElement;

    el.value = value;
    el.dispatchEvent(new Event('change'));
    await settle();
  };
  const sideButtons = (): HTMLButtonElement[] => Array.from(root().querySelectorAll<HTMLButtonElement>('.nf__side'));
  const pressSide = async (name: string): Promise<void> => {
    sideButtons()
      .find(b => b.textContent.trim() === name)
      ?.click();
    await settle();
  };
  const save = async (): Promise<void> => {
    TestBed.inject(AssistantEditorController).run('save');
    await settle();
  };

  beforeEach(async () => {
    source = new FakeSource();
    writer = new FakeWriter();
    clinical = new FakeClinical();
    saved = jasmine.createSpy('saved');
    TestBed.configureTestingModule({
      providers: [
        { provide: AssessmentSource, useValue: source },
        { provide: AssessmentWriter, useValue: writer },
        { provide: ClinicalAssessmentSource, useValue: clinical },
      ],
    });
    await create();
  });

  it('mostra só os itens fixos (sem peso e altura), com o valor atual e o "Anterior"', () => {
    expect(root().querySelectorAll('[data-testid="nutritional-item"]').length).toBe(5);
    expect(text()).toContain('Circunferência da panturrilha');
    expect(text()).toContain('Risco de disfagia');
    expect(text()).not.toContain('Peso');
    expect(text()).not.toContain('Altura');
    expect((root().querySelector('#nf-handgrip') as HTMLInputElement).value).toBe('14');
    expect(text()).toContain('Anterior: 12 kgf em 20/05.');
  });

  it('membro aferido: dois botões, nenhum ativo no início; depois só se troca de um para o outro', async () => {
    const pressed = (): string[] =>
      sideButtons()
        .slice(0, 2)
        .map(b => b.getAttribute('aria-pressed') ?? '');

    expect(pressed()).toEqual(['false', 'false']);
    expect(text()).not.toContain('Informe também o membro aferido');

    await pressSide('Direito');

    expect(pressed()).toEqual(['true', 'false']);

    await pressSide('Direito');

    expect(pressed()).toEqual(['true', 'false']);

    sideButtons()[1].click();
    await settle();

    expect(pressed()).toEqual(['false', 'true']);
  });

  it('o título não repete a unidade: ela fica dentro do campo', () => {
    expect(root().querySelector('label[for="nf-calfCircumference"]')?.textContent.trim()).toBe(
      'Circunferência da panturrilha',
    );

    expect(root().querySelector('.field-card__unit')?.textContent.trim()).toBe('cm');
  });

  it('falha ao carregar avisa e deixa os campos vazios', async () => {
    source.fails = true;
    await create();

    expect(text()).toContain('Não foi possível carregar a avaliação anterior');
  });

  it('sem calorimetria, mostra o cálculo kcal/kg com o peso da Avaliação clínica', () => {
    expect(text()).toContain('Calculado (kcal/kg): 1250 kcal/dia');
  });

  it('salvar grava só o que foi preenchido, com o gasto energético, avisa a tela e fecha o painel', async () => {
    const assistant = TestBed.inject(AiAssistantService);

    spyOn(assistant, 'closePanel');
    await type('#nf-calfCircumference', '31');
    await pressSide('Direito');
    await choose('#nf-dysphagia', 'Risco baixo');
    await save();

    expect(writer.saved[0]).toEqual({
      calfCircumference: '31',
      calfSide: 'Direito',
      dysphagia: 'Risco baixo',
      energyExpenditure: '1250',
      energySource: 'kcal/kg',
      handgrip: '14',
    });

    expect(saved).toHaveBeenCalledTimes(1);
    expect(assistant.closePanel).toHaveBeenCalledWith();
  });

  it('a calorimetria informada prevalece sobre o kcal/kg', async () => {
    await type('#nf-indirectCalorimetry', '1450');
    await save();

    expect(writer.saved[0].energyExpenditure).toBe('1450');
    expect(writer.saved[0].energySource).toBe('Calorimetria indireta');
  });

  it('valor sem membro avisa em texto e o membro órfão é ignorado ao salvar', async () => {
    await type('#nf-armCircumference', '27');

    expect(text()).toContain('Informe o membro aferido.');

    await save();

    expect(writer.saved[0].armCircumference).toBe('27');
    expect(writer.saved[0].armSide).toBeUndefined();

    await pressSide('Direito');
    await type('#nf-armCircumference', '');
    await save();

    expect(writer.saved[1].calfSide).toBeUndefined();
  });

  it('sem peso, não há cálculo kcal/kg', async () => {
    clinical.weight = null;
    source.latest = null;
    await create();
    await save();

    expect(text()).not.toContain('Calculado');
    expect(writer.saved[0]).toEqual({});
  });

  it('falha ao ler o peso da Avaliação clínica não impede o editor', async () => {
    clinical.fails = true;
    await create();

    expect(root().querySelectorAll('[data-testid="nutritional-item"]').length).toBe(5);
  });

  it('falha ao gravar mantém os valores e avisa', async () => {
    writer.fails = true;
    const assistant = TestBed.inject(AiAssistantService);

    spyOn(assistant, 'closePanel');
    await save();

    expect(text()).toContain('Não foi possível salvar a avaliação');
    expect((root().querySelector('#nf-handgrip') as HTMLInputElement).value).toBe('14');
    expect(saved).not.toHaveBeenCalled();
    expect(assistant.closePanel).not.toHaveBeenCalled();
  });

  it('o editor se registra no rodapé com a ação Salvar e se remove ao ser destruído', () => {
    const controller = TestBed.inject(AssistantEditorController);

    expect(
      controller
        .active()
        ?.actions()
        .map(a => a.id),
    ).toEqual(['save']);
    fixture.destroy();

    expect(controller.active()).toBeNull();
  });
});
