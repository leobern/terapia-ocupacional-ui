import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { AssessmentValues, NutritionFunctionalAssessment } from './assessment.models';
import {
  AssessmentSectionComponent,
  LOAD_FAILED_HINT,
  OFFLINE_SAVE_HINT,
  SAVE_FAILED_HINT,
} from './assessment-section.component';
import { AssessmentSource } from './assessment-source';
import { AssessmentWriter } from './assessment-writer';
import { ProvisionalAssessmentSource } from './provisional-assessment-source';

class FakeSource extends AssessmentSource {
  result: Promise<NutritionFunctionalAssessment | null> = Promise.resolve(null);
  readonly calls: string[] = [];

  loadLatest(patientId: string): Promise<NutritionFunctionalAssessment | null> {
    this.calls.push(patientId);

    return this.result;
  }
}

class FakeWriter extends AssessmentWriter {
  result: Promise<void> = Promise.resolve();
  readonly saved: { patientId: string; values: AssessmentValues }[] = [];

  save(patientId: string, values: AssessmentValues): Promise<void> {
    this.saved.push({ patientId, values });

    return this.result;
  }
}

describe('AssessmentSectionComponent', () => {
  let writer: FakeWriter;
  let fixture: ComponentFixture<AssessmentSectionComponent>;
  let source: FakeSource;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dialog = (): HTMLDialogElement => el().querySelector('dialog') as HTMLDialogElement;
  const row = (): HTMLButtonElement => el().querySelector('.assessment__row') as HTMLButtonElement;
  const input = (id: string): HTMLInputElement => el().querySelector(`#assessment-${id}`) as HTMLInputElement;
  const select = (id: string): HTMLSelectElement => el().querySelector(`#assessment-${id}`) as HTMLSelectElement;
  const type = (id: string, value: string): void => {
    const field = input(id);

    field.value = value;
    field.dispatchEvent(new Event('input'));
  };
  const saveButton = (): HTMLButtonElement => el().querySelector('.assessment__save button') as HTMLButtonElement;
  const help = (id: string): string => (el().querySelector(`#assessment-help-${id}`) as HTMLElement).textContent.trim();
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const openIt = async (): Promise<void> => {
    row().click();
    await settle();
  };

  beforeEach(async () => {
    source = new FakeSource();
    writer = new FakeWriter();
    TestBed.configureTestingModule({
      providers: [
        { provide: AssessmentSource, useValue: source },
        { provide: AssessmentWriter, useValue: writer },
      ],
    });
    fixture = TestBed.createComponent(AssessmentSectionComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    await settle();
  });

  it('aparece recolhida por padrão, com o modal fechado', () => {
    expect(row().textContent).toContain('Avaliação Nutricional e Funcional');
    expect(dialog().open).toBe(false);
    expect(source.calls).toEqual([]);
  });

  it('abre o modal com as duas sub-seções e todos os campos vazios (sem avaliação anterior)', async () => {
    await openIt();

    expect(dialog().open).toBe(true);
    const titles = Array.from(el().querySelectorAll('.assessment__section-title')).map(t => t.textContent.trim());

    expect(titles).toEqual(['Avaliação nutricional', 'Avaliação funcional']);
    for (const id of ['weight', 'height', 'handgrip', 'dysphagia']) {
      expect((el().querySelector(`#assessment-${id}`) as HTMLInputElement).value).toBe('');
    }

    expect(input('weight').placeholder).toBe('Ex.: 51,0');
    expect(help('height')).toBe('Usada no cálculo do IMC.');
    expect(source.calls).toEqual(['p1']);
  });

  it('mostra o contador de campos de cada sub-seção', async () => {
    await openIt();
    const counts = Array.from(el().querySelectorAll('.assessment__count')).map(c => c.textContent.trim());

    expect(counts).toEqual(['5', '2']);
  });

  it('pré-preenche com a avaliação mais recente e mostra o valor anterior com data', async () => {
    source.result = Promise.resolve({
      previous: { weight: { at: '2026-05-20T12:00:00', value: '50,4' } },
      values: { handgrip: '14', weight: '51,0' },
    });
    await openIt();

    expect(input('weight').value).toBe('51,0');
    expect(input('handgrip').value).toBe('14');
    expect(input('height').value).toBe('');
    expect(select('dysphagia').value).toBe('');
    expect(help('weight')).toBe('Anterior: 50,4 kg em 20/05.');
    expect(help('height')).toBe('Usada no cálculo do IMC.');
  });

  it('mostra o valor anterior sem unidade quando o campo não tem unidade', async () => {
    source.result = Promise.resolve({
      previous: { dysphagia: { at: '2026-05-02T12:00:00', value: 'Baixo' } },
      values: {},
    });
    await openIt();

    expect(help('dysphagia')).toBe('Anterior: Baixo em 02/05.');
  });

  it('mostra carregamento enquanto a leitura não termina', async () => {
    let resolve: (v: NutritionFunctionalAssessment | null) => void = _ => undefined;

    source.result = new Promise(r => (resolve = r));
    row().click();
    fixture.detectChanges();

    expect(el().querySelector('[role="status"]')?.textContent).toContain('Carregando');
    resolve(null);
    await settle();

    expect(el().querySelector('[role="status"]')).toBeNull();
  });

  it('abre vazio com aviso quando a leitura falha', async () => {
    source.result = Promise.reject(new Error('x'));
    await openIt();

    expect(dialog().open).toBe(true);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain(LOAD_FAILED_HINT);
    expect(input('weight').value).toBe('');
  });

  it('ignora resposta de uma abertura já fechada', async () => {
    let resolve: (v: NutritionFunctionalAssessment | null) => void = _ => undefined;

    source.result = new Promise(r => (resolve = r));
    row().click();
    fixture.detectChanges();
    (el().querySelector('app-icon-button button') as HTMLButtonElement).click();
    resolve({ previous: {}, values: { weight: '99' } });
    await settle();

    expect(dialog().open).toBe(false);
    expect(input('weight').value).toBe('');
  });

  it('ignora falha de uma abertura já fechada', async () => {
    let reject: (e: Error) => void = _ => undefined;

    source.result = new Promise((_, r) => (reject = r));
    row().click();
    fixture.detectChanges();
    (el().querySelector('app-icon-button button') as HTMLButtonElement).click();
    reject(new Error('x'));
    await settle();

    expect(el().querySelector('[role="alert"]')).toBeNull();
  });

  it('fechar volta ao Hub com a seção recolhida', async () => {
    await openIt();
    (el().querySelector('app-icon-button button') as HTMLButtonElement).click();
    await settle();

    expect(dialog().open).toBe(false);
    expect(row().getAttribute('aria-expanded')).toBe('false');
  });

  it('fecha pelo scrim e pelo Esc', async () => {
    await openIt();
    dialog().click();
    await settle();

    expect(dialog().open).toBe(false);

    await openIt();
    const cancel = new Event('cancel', { cancelable: true });

    dialog().dispatchEvent(cancel);
    await settle();

    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(false);
  });

  it('clique dentro do conteúdo não fecha', async () => {
    await openIt();
    (el().querySelector('.assessment__title') as HTMLElement).click();
    await settle();

    expect(dialog().open).toBe(true);
  });

  describe('edição e salvamento', () => {
    it('digitar faz o valor constar no campo, inclusive com vírgula decimal', async () => {
      await openIt();
      type('weight', '52,3');
      await settle();

      expect(input('weight').value).toBe('52,3');
    });

    it('escolher o risco de disfagia faz a opção constar no campo', async () => {
      await openIt();
      select('dysphagia').value = 'Risco alto';
      select('dysphagia').dispatchEvent(new Event('change'));
      await settle();

      expect(select('dysphagia').value).toBe('Risco alto');
      expect(Array.from(select('dysphagia').options).map(o => o.value)).toEqual([
        '',
        'Sem risco',
        'Risco baixo',
        'Risco moderado',
        'Risco alto',
      ]);
    });

    it('campo pré-preenchido pode ser editado e salvo', async () => {
      source.result = Promise.resolve({ previous: {}, values: { weight: '51,0', handgrip: '14' } });
      await openIt();
      type('weight', '49,5');
      await settle();
      saveButton().click();
      await settle();

      expect(writer.saved).toEqual([
        {
          patientId: 'p1',
          values: {
            energyExpenditure: '1238',
            energySource: 'kcal/kg',
            handgrip: '14',
            weight: '49,5',
          },
        },
      ]);
    });

    it('salvar com tudo vazio é aceito e fecha o formulário', async () => {
      await openIt();
      saveButton().click();
      await settle();

      expect(writer.saved).toEqual([{ patientId: 'p1', values: {} }]);
      expect(dialog().open).toBe(false);
    });

    it('salvar só com alguns campos envia os preenchidos como digitados e omite os vazios', async () => {
      await openIt();
      type('height', '163');
      type('handgrip', '   ');
      select('dysphagia').value = 'Sem risco';
      select('dysphagia').dispatchEvent(new Event('change'));
      await settle();
      saveButton().click();
      await settle();

      expect(writer.saved[0].values).toEqual({ dysphagia: 'Sem risco', height: '163' });
    });

    describe('gasto energético', () => {
      it('mostra o card de calorimetria vazio e, com peso, o cálculo kcal/kg que acompanha o peso', async () => {
        await openIt();

        expect(input('indirectCalorimetry').value).toBe('');
        expect(help('indirectCalorimetry')).toContain('calculado por kcal/kg');
        type('weight', '51,0');
        await settle();

        expect(help('indirectCalorimetry')).toContain('Calculado (kcal/kg): 1275 kcal/dia');
        type('weight', '40');
        await settle();

        expect(help('indirectCalorimetry')).toContain('1000 kcal/dia');
      });

      it('sem calorimetria, salva o calculado com a origem kcal/kg', async () => {
        await openIt();
        type('weight', '51');
        await settle();
        saveButton().click();
        await settle();

        expect(writer.saved[0].values).toEqual({ energyExpenditure: '1275', energySource: 'kcal/kg', weight: '51' });
      });

      it('com calorimetria, ela prevalece e o calculado deixa de ser usado', async () => {
        await openIt();
        type('weight', '51');
        type('indirectCalorimetry', '1450');
        await settle();

        expect(help('indirectCalorimetry')).not.toContain('Calculado');
        saveButton().click();
        await settle();

        expect(writer.saved[0].values).toEqual({
          energyExpenditure: '1450',
          energySource: 'Calorimetria indireta',
          indirectCalorimetry: '1450',
          weight: '51',
        });
      });

      it('sem peso e sem calorimetria, nada é calculado; peso inválido também não', async () => {
        await openIt();
        type('weight', 'abc');
        await settle();
        saveButton().click();
        await settle();

        expect(writer.saved[0].values).toEqual({ weight: 'abc' });
      });

      it('reavaliação descarta o gasto salvo antes e recalcula', async () => {
        source.result = Promise.resolve({
          previous: {},
          values: { energyExpenditure: '1000', energySource: 'kcal/kg', weight: '40' },
        });
        await openIt();
        type('weight', '60');
        await settle();
        saveButton().click();
        await settle();

        expect(writer.saved[0].values).toEqual({ energyExpenditure: '1500', energySource: 'kcal/kg', weight: '60' });
      });
    });

    describe('circunferências com membro aferido', () => {
      const sideButtons = (): HTMLButtonElement[] =>
        Array.from(el().querySelectorAll<HTMLButtonElement>('.assessment__side')[0].querySelectorAll('button'));
      const warning = (): string[] =>
        Array.from(el().querySelectorAll('.assessment__side ~ .assessment__status')).map(n => n.textContent.trim());

      it('mostra os cards vazios, com as opções Direito e Esquerdo em texto', async () => {
        await openIt();

        expect(input('calfCircumference').value).toBe('');
        expect(input('armCircumference').value).toBe('');
        expect(sideButtons().map(b => b.textContent.trim())).toEqual(['Direito', 'Esquerdo']);
      });

      it('escolher o membro o deixa marcado e envia valor e membro juntos', async () => {
        await openIt();
        type('calfCircumference', '32');
        sideButtons()[1].click();
        await settle();

        expect(sideButtons()[1].getAttribute('aria-checked')).toBe('true');
        expect(sideButtons()[0].getAttribute('aria-checked')).toBe('false');
        saveButton().click();
        await settle();

        expect(writer.saved[0].values).toEqual({ calfCircumference: '32', calfSide: 'Esquerdo' });
      });

      it('valor sem membro avisa em texto, mas salva', async () => {
        await openIt();
        type('armCircumference', '27');
        await settle();

        expect(warning()[0]).toContain('Informe o membro aferido');
        saveButton().click();
        await settle();

        expect(writer.saved[0].values).toEqual({ armCircumference: '27' });
      });

      it('membro sem valor é ignorado ao salvar', async () => {
        await openIt();
        sideButtons()[0].click();
        await settle();

        expect(warning()).toEqual([]);
        saveButton().click();
        await settle();

        expect(writer.saved[0].values).toEqual({});
      });

      it('reabre pré-preenchido com valor e membro', async () => {
        source.result = Promise.resolve({
          previous: {},
          values: { calfCircumference: '31', calfSide: 'Direito' },
        });
        await openIt();

        expect(input('calfCircumference').value).toBe('31');
        expect(sideButtons()[0].getAttribute('aria-checked')).toBe('true');
      });
    });

    it('falha ao salvar mantém o formulário aberto, com os valores e mensagem em texto', async () => {
      writer.result = Promise.reject(new Error('x'));
      await openIt();
      type('weight', '60');
      await settle();
      saveButton().click();
      await settle();

      expect(dialog().open).toBe(true);
      expect(input('weight').value).toBe('60');
      expect(el().querySelector('[role="alert"]')?.textContent).toContain(SAVE_FAILED_HINT);
      expect(saveButton().disabled).toBe(false);
    });

    it('offline mantém a edição, desabilita salvar e avisa em texto', async () => {
      await openIt();
      TestBed.inject(ConnectivityService).online.set(false);
      type('weight', '60');
      await settle();

      expect(input('weight').value).toBe('60');
      expect(saveButton().disabled).toBe(true);
      expect(el().textContent).toContain(OFFLINE_SAVE_HINT);
      (el().querySelector('.assessment__save') as HTMLElement).click();
      await settle();

      expect(writer.saved).toEqual([]);
      expect(input('weight').value).toBe('60');
      TestBed.inject(ConnectivityService).online.set(true);
    });

    it('não salva duas vezes enquanto grava nem durante o carregamento', async () => {
      let resolve: () => void = () => undefined;

      writer.result = new Promise<void>(r => (resolve = r));
      await openIt();
      (el().querySelector('.assessment__save') as HTMLElement).click();
      (el().querySelector('.assessment__save') as HTMLElement).click();
      await settle();

      expect(writer.saved.length).toBe(1);
      resolve();
      await settle();

      let load: (v: null) => void = _ => undefined;

      source.result = new Promise<null>(r => (load = r));
      row().click();
      fixture.detectChanges();
      (el().querySelector('.assessment__save') as HTMLElement).click();

      expect(writer.saved.length).toBe(1);
      load(null);
      await settle();
    });

    it('reabrir descarta o rascunho anterior e limpa o aviso de falha', async () => {
      writer.result = Promise.reject(new Error('x'));
      await openIt();
      type('weight', '60');
      saveButton().click();
      await settle();
      (el().querySelector('app-icon-button button') as HTMLButtonElement).click();
      await settle();
      await openIt();

      expect(input('weight').value).toBe('');
      expect(el().querySelector('[role="alert"]')).toBeNull();
    });
  });
});

describe('ProvisionalAssessmentSource', () => {
  it('devolve null para paciente sem avaliação e a avaliação de exemplo para p1', async () => {
    const source = new ProvisionalAssessmentSource();

    expect(await source.loadLatest('p9')).toBeNull();
    expect((await source.loadLatest('p1'))?.values.weight).toBe('51,0');
  });

  it('devolve na próxima leitura a avaliação salva', async () => {
    const source = new ProvisionalAssessmentSource();

    await source.save('p9', { weight: '70' });

    expect((await source.loadLatest('p9'))?.values).toEqual({ weight: '70' });
  });
});
