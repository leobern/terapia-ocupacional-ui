import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import { AssistantEditorController } from '../../../shared/services/assistant-editor-controller.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { HypothesisSaveRequest } from '../patient-hub.models';
import { HypothesisSynthesizer, HypothesisWriter } from '../patient-hub-source';
import {
  DIAGNOSIS_EMPTY_HINT,
  DIAGNOSIS_MAX_LENGTH,
  DIAGNOSIS_OFFLINE_HINT,
  DIAGNOSIS_SAVE_FAILED_HINT,
  DIAGNOSIS_SYNTH_FAILED_HINT,
  DiagnosisEditorComponent,
} from './diagnosis-editor.component';

class FakeSynth extends HypothesisSynthesizer {
  result: Promise<string> = Promise.resolve('Texto da IA');
  readonly calls: string[] = [];

  synthesize(text: string): Promise<string> {
    this.calls.push(text);

    return this.result;
  }
}

class FakeWriter extends HypothesisWriter {
  fail = false;
  readonly saved: HypothesisSaveRequest[] = [];

  save(request: HypothesisSaveRequest): Promise<void> {
    if (this.fail) {
      return Promise.reject(new Error('x'));
    }
    this.saved.push(request);

    return Promise.resolve();
  }
}

describe('DiagnosisEditorComponent', () => {
  let fixture: ComponentFixture<DiagnosisEditorComponent>;
  let synth: FakeSynth;
  let writer: FakeWriter;
  let saved: jasmine.Spy;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => root().textContent.replace(/\s+/gu, ' ');
  const area = (): HTMLTextAreaElement => root().querySelector('#dx-text') as HTMLTextAreaElement;
  const controller = (): AssistantEditorController => TestBed.inject(AssistantEditorController);
  const actionIds = (): string[] =>
    controller()
      .active()
      ?.actions()
      .map(a => a.id) ?? [];
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const type = async (value: string): Promise<void> => {
    area().value = value;
    area().dispatchEvent(new Event('input'));
    await settle();
  };
  const run = async (id: string): Promise<void> => {
    controller().run(id);
    await settle();
  };
  const create = async (initial = ''): Promise<void> => {
    fixture = TestBed.createComponent(DiagnosisEditorComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentRef.setInput('initialText', initial);
    fixture.componentRef.setInput('responsibleName', 'Dr. Wanderson Romualdo');
    fixture.componentRef.setInput('responsibleRole', 'Médico assistente');
    fixture.componentRef.setInput('saved', saved);
    await settle();
  };

  beforeEach(async () => {
    synth = new FakeSynth();
    writer = new FakeWriter();
    saved = jasmine.createSpy('saved');
    TestBed.configureTestingModule({
      providers: [
        { provide: HypothesisSynthesizer, useValue: synth },
        { provide: HypothesisWriter, useValue: writer },
        { provide: NOW, useValue: (): Date => new Date(2026, 4, 28, 12, 0) },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): { name: string; role: string } => ({ name: 'Michelle', role: 'doctor' }) },
        },
      ],
    });
    TestBed.inject(ConnectivityService).online.set(true);
    await create();
  });

  it('mostra o texto do prontuário (até 1K) e, abaixo, o médico responsável', () => {
    expect(text()).toContain('Texto do prontuário');
    expect(text()).toContain('0/1000');
    expect(area().maxLength).toBe(DIAGNOSIS_MAX_LENGTH);
    expect(text()).toContain('Médico responsável');
    expect(text()).toContain('Dr. Wanderson Romualdo');
    expect(text()).toContain('Médico assistente');
  });

  it('sem texto não há atalhos; com texto aparecem "Sintetizar texto com IA" e "Salvar"', async () => {
    expect(actionIds()).toEqual([]);

    await type('Paciente com IRA.');

    expect(actionIds()).toEqual(['synthesize', 'save']);
    expect(controller().active()?.actions()[0].label).toBe('Sintetizar texto com IA');
    expect(text()).toContain('17/1000');

    await type('   ');

    expect(actionIds()).toEqual([]);
  });

  it('abre já com o texto atual na edição', async () => {
    await create('Diagnóstico atual.');

    expect(area().value).toBe('Diagnóstico atual.');
    expect(actionIds()).toEqual(['synthesize', 'save']);
  });

  it('sintetizar envia o texto, troca pelo resultado e só grava no Salvar (origem ai)', async () => {
    await type('prontuário longo');
    await run('synthesize');

    expect(synth.calls).toEqual(['prontuário longo']);
    expect(area().value).toBe('Texto da IA');
    expect(writer.saved).toEqual([]);

    await run('save');

    expect(writer.saved).toEqual([
      jasmine.objectContaining({ author: 'Michelle', origin: 'ai', patientId: 'p1', text: 'Texto da IA' }),
    ]);

    expect(writer.saved[0].at).toMatch(/^\d{4}-/);
    expect(saved).toHaveBeenCalledOnceWith('Texto da IA');
  });

  it('texto da IA editado antes de salvar grava a origem ai-edited', async () => {
    await type('x');
    await run('synthesize');
    await type('  Texto editado  ');
    await run('save');

    expect(writer.saved[0]).toEqual(jasmine.objectContaining({ origin: 'ai-edited', text: 'Texto editado' }));
  });

  it('salvar sem usar a IA grava a origem manual e fecha o painel', async () => {
    const assistant = TestBed.inject(AiAssistantService);

    spyOn(assistant, 'closePanel');
    await type('Digitado à mão');
    await run('save');

    expect(writer.saved[0]).toEqual(jasmine.objectContaining({ origin: 'manual', text: 'Digitado à mão' }));
    expect(assistant.closePanel).toHaveBeenCalledWith();
  });

  it('na falha da IA avisa em texto e mantém o texto para salvar à mão', async () => {
    synth.result = Promise.reject(new Error('fora do ar'));
    await type('colado');
    await run('synthesize');

    expect(text()).toContain(DIAGNOSIS_SYNTH_FAILED_HINT);
    expect(area().value).toBe('colado');

    await run('save');

    expect(writer.saved[0]).toEqual(jasmine.objectContaining({ origin: 'manual', text: 'colado' }));
  });

  it('falha ao gravar avisa e mantém o texto, sem avisar a tela', async () => {
    writer.fail = true;
    await type('x');
    await run('save');

    expect(text()).toContain(DIAGNOSIS_SAVE_FAILED_HINT);
    expect(area().value).toBe('x');
    expect(saved).not.toHaveBeenCalled();
  });

  it('texto vazio não sintetiza nem salva e orienta a escrever', async () => {
    const instance = fixture.componentInstance as unknown as { save(): Promise<void>; synthesize(): Promise<void> };

    await instance.synthesize();
    await settle();

    expect(text()).toContain(DIAGNOSIS_EMPTY_HINT);

    await instance.save();

    expect(synth.calls).toEqual([]);
    expect(writer.saved).toEqual([]);
  });

  it('offline: síntese e gravação indisponíveis com a mensagem de conexão necessária', async () => {
    await type('x');
    TestBed.inject(ConnectivityService).online.set(false);
    await run('synthesize');

    expect(text()).toContain(DIAGNOSIS_OFFLINE_HINT);

    await run('save');

    expect(writer.saved).toEqual([]);
    expect(synth.calls).toEqual([]);
    TestBed.inject(ConnectivityService).online.set(true);
  });

  it('enquanto processa, ignora um segundo pedido', async () => {
    const resolvers: ((v: string) => void)[] = [];

    synth.result = new Promise<string>(r => resolvers.push(r));
    await type('x');
    controller().run('synthesize');
    controller().run('synthesize');
    controller().run('save');
    await settle();

    expect(synth.calls.length).toBe(1);
    expect(text()).toContain('Processando');
    expect(writer.saved).toEqual([]);

    resolvers[0]('pronto');
    await settle();

    expect(area().value).toBe('pronto');
  });

  it('o editor se remove do rodapé ao ser destruído', () => {
    fixture.destroy();

    expect(controller().active()).toBeNull();
  });
});
