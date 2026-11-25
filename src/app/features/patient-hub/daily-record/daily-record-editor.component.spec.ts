import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import { AssistantEditorController } from '../../../shared/services/assistant-editor-controller.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { PrescriptionSource } from '../prescription/prescription-source';
import { DailyEvolutionSource } from './daily-evolution-source';
import { INVALID_VALUE_HINT, NewParameterEntry, NOTHING_TO_SAVE_HINT, ParameterEntry } from './daily-record.models';
import {
  DAILY_NAME_REQUIRED_HINT,
  DAILY_OFFLINE_HINT,
  DAILY_SAVE_FAILED_HINT,
  DailyRecordEditorComponent,
} from './daily-record-editor.component';
import { DailyRecordWriter } from './daily-record-writer';
import { EvolutionAiStructurer } from './evolution-ai-structurer';

class FakeWriter extends DailyRecordWriter {
  fail = false;
  readonly recorded: NewParameterEntry[][] = [];

  record(_: string, entries: readonly NewParameterEntry[]): Promise<readonly ParameterEntry[]> {
    if (this.fail) {
      return Promise.reject(new Error('x'));
    }
    this.recorded.push([...entries]);

    return Promise.resolve([]);
  }
}

describe('DailyRecordEditorComponent', () => {
  let fixture: ComponentFixture<DailyRecordEditorComponent>;
  let writer: FakeWriter;
  let saved: jasmine.Spy;
  let evolutionFails: boolean;
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
  const fill = async (id: string, value: string): Promise<void> => {
    const el = root().querySelector(`#${id}`) as HTMLInputElement;

    el.value = value;
    el.dispatchEvent(new Event('input'));
    await settle();
  };
  const run = async (id: string): Promise<void> => {
    controller().run(id);
    await settle();
  };

  beforeEach(async () => {
    writer = new FakeWriter();
    evolutionFails = false;
    saved = jasmine.createSpy('saved');
    TestBed.configureTestingModule({
      providers: [
        { provide: DailyRecordWriter, useValue: writer },
        { provide: EvolutionAiStructurer, useValue: { suggest: (): Promise<string> => Promise.resolve('') } },
        {
          provide: PrescriptionSource,
          useValue: {
            load: (): Promise<[]> => Promise.resolve([]),
            loadActive: (): Promise<[]> => Promise.resolve([]),
          },
        },
        {
          provide: DailyEvolutionSource,
          useValue: {
            load: (): Promise<null> => Promise.resolve(null),
            save: (r: { text: string }): Promise<unknown> =>
              evolutionFails
                ? Promise.reject(new Error('x'))
                : Promise.resolve({
                    at: '2026-05-28T12:00:00Z',
                    author: 'Michelle',
                    origin: 'manual',
                    reevaluations: [],
                    text: r.text,
                  }),
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
    fixture = TestBed.createComponent(DailyRecordEditorComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentRef.setInput('saved', saved);
    await settle();
  });

  it('começa só com os atalhos de inserir; "Salvar" aparece com algo preenchido', async () => {
    expect(actionIds()).toEqual(['parameters', 'lab']);
    await run('parameters');

    expect(actionIds()).toEqual(['lab']);
    const first = root().querySelector('input[id^="dre-"]') as HTMLInputElement;

    await fill(first.id, '120');

    expect(actionIds()).toEqual(['lab', 'save']);
  });

  it('salva só os parâmetros preenchidos e fecha o painel', async () => {
    const assistant = TestBed.inject(AiAssistantService);

    spyOn(assistant, 'closePanel');
    await run('parameters');
    const first = root().querySelector('input[id^="dre-"]') as HTMLInputElement;

    await fill(first.id, '4,5');
    await run('save');

    expect(writer.recorded.length).toBe(1);
    expect(writer.recorded[0].length).toBe(1);
    expect(writer.recorded[0][0].value).toBe(4.5);
    expect(saved).toHaveBeenCalledWith();
    expect(assistant.closePanel).toHaveBeenCalledWith();
  });

  it('valor inválido não grava e mostra o erro no card', async () => {
    await run('parameters');
    const first = root().querySelector('input[id^="dre-"]') as HTMLInputElement;

    await fill(first.id, 'abc');
    await run('save');

    expect(writer.recorded).toEqual([]);
    expect(text()).toContain(INVALID_VALUE_HINT);
  });

  it('resultado laboratorial vira parâmetro com nome e unidade; sem nome pede o nome', async () => {
    await run('lab');
    await fill('dre-lab-1', '3,2');
    await run('save');

    expect(text()).toContain(DAILY_NAME_REQUIRED_HINT);
    await fill('dre-name-lab-1', 'Albumina');
    await fill('dre-unit-lab-1', 'g/dL');
    await run('save');

    expect(writer.recorded[0][0]).toEqual(
      jasmine.objectContaining({ parameterLabel: 'Albumina', unit: 'g/dL', value: 3.2 }),
    );
  });

  it('salvar sem nada preenchido avisa; offline e falha mantêm os valores', async () => {
    (fixture.componentInstance as unknown as { save(): Promise<void> }).save();
    await settle();

    expect(text()).toContain(NOTHING_TO_SAVE_HINT);
    await run('parameters');
    const first = root().querySelector('input[id^="dre-"]') as HTMLInputElement;

    await fill(first.id, '10');
    TestBed.inject(ConnectivityService).online.set(false);
    await run('save');

    expect(text()).toContain(DAILY_OFFLINE_HINT);
    TestBed.inject(ConnectivityService).online.set(true);
    writer.fail = true;
    await run('save');

    expect(text()).toContain(DAILY_SAVE_FAILED_HINT);
    expect((root().querySelector(`#${first.id}`) as HTMLInputElement).value).toBe('10');
  });

  describe('evolução médica no mesmo painel', () => {
    const typeEvolution = async (value: string): Promise<void> => {
      const area = root().querySelector('#evolution-text') as HTMLTextAreaElement;

      area.value = value;
      area.dispatchEvent(new Event('input'));
      await settle();
    };

    it('não repete o campo de mensagem nem botões próprios da evolução', () => {
      expect(root().querySelectorAll('app-input-chat').length).toBe(0);
      expect(
        Array.from(root().querySelectorAll('button')).some(b => b.textContent.includes('Salvar evolução')),
      ).toBeFalse();
    });

    it('com a evolução escrita aparece "Salvar"; salva só a evolução e fecha o painel', async () => {
      const assistant = TestBed.inject(AiAssistantService);

      spyOn(assistant, 'closePanel');
      await typeEvolution('Paciente estável.');

      expect(actionIds()).toContain('save');
      await run('save');

      expect(writer.recorded).toEqual([]);
      expect(saved).toHaveBeenCalledWith();
      expect(assistant.closePanel).toHaveBeenCalledWith();
    });

    it('salva parâmetros e evolução juntos; falha na evolução mantém o painel e avisa', async () => {
      const assistant = TestBed.inject(AiAssistantService);

      spyOn(assistant, 'closePanel');
      await run('parameters');
      const first = root().querySelector('input[id^="dre-"]') as HTMLInputElement;

      await fill(first.id, '120');
      await typeEvolution('Texto.');
      evolutionFails = true;
      await run('save');

      expect(writer.recorded.length).toBe(1);
      expect(assistant.closePanel).not.toHaveBeenCalled();
      expect(text()).toContain(DAILY_SAVE_FAILED_HINT);
    });
  });
});
