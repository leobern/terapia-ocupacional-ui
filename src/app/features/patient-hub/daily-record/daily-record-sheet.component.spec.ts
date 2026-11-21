import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { InputChatComponent } from '../../../shared/components/input-chat/input-chat.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { PrescriptionSource } from '../prescription/prescription-source';
import { DailyEvolutionSource } from './daily-evolution-source';
import { DailyEvolution, ParameterEntry, SuggestedParameter } from './daily-record.models';
import {
  AI_EMPTY_HINT,
  AI_FAILED_HINT,
  AI_MIC_DENIED_HINT,
  AI_MIC_FAILED_HINT,
  AI_SUGGESTED_NOTE,
  AI_UNAVAILABLE_HINT,
  DailyRecordSheetComponent,
  EXTRA_NAME_REQUIRED_HINT,
  LOAD_FAILED_HINT,
  OFFLINE_SAVE_HINT,
  SAVE_FAILED_HINT,
  SAVED_HINT,
} from './daily-record-sheet.component';
import { DailyRecordSource } from './daily-record-source';
import { DailyRecordWriter } from './daily-record-writer';
import { EvolutionAiStructurer } from './evolution-ai-structurer';
import { ParameterAiStructurer } from './parameter-ai-structurer';
import { ProvisionalDailyRecordSource } from './provisional-daily-record-source';

const TODAY = new Date(2026, 4, 28, 12, 0);

class EvolutionStub extends DailyEvolutionSource {
  current: DailyEvolution | null = null;

  load(): Promise<DailyEvolution | null> {
    return Promise.resolve(this.current);
  }

  save(): Promise<DailyEvolution> {
    return Promise.reject(new Error('não usado aqui'));
  }
}

class FakeParameterAi extends ParameterAiStructurer {
  result: Promise<readonly SuggestedParameter[]> = Promise.resolve([]);
  calls = 0;

  suggest(): Promise<readonly SuggestedParameter[]> {
    this.calls++;

    return this.result;
  }
}

describe('DailyRecordSheetComponent', () => {
  let ai: FakeParameterAi;
  let fixture: ComponentFixture<DailyRecordSheetComponent>;
  let store: ProvisionalDailyRecordSource;
  let online: WritableSignal<boolean>;
  let nowValue: Date;
  let loadSpy: jasmine.Spy;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dialog = (): HTMLDialogElement => el().querySelector('dialog') as HTMLDialogElement;
  const input = (id: string): HTMLInputElement => el().querySelector(`#daily-${id}`) as HTMLInputElement;
  const help = (id: string): string => (el().querySelector(`#daily-help-${id}`) as HTMLElement).textContent.trim();
  const saveButton = (): HTMLButtonElement => el().querySelector('.daily__save button') as HTMLButtonElement;
  const type = (id: string, value: string): void => {
    input(id).value = value;
    input(id).dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const openIt = async (): Promise<void> => {
    fixture.componentRef.setInput('open', true);
    await settle();
  };
  const save = async (): Promise<void> => {
    saveButton().click();
    await settle();
  };
  const at = (h: number, m: number): string => new Date(2026, 4, 28, h, m).toISOString();

  beforeEach(() => {
    store = new ProvisionalDailyRecordSource();
    ai = new FakeParameterAi();
    online = signal(true);
    nowValue = TODAY;
    loadSpy = spyOn(store, 'loadEntries').and.callThrough();
    TestBed.configureTestingModule({
      providers: [
        { provide: DailyRecordSource, useValue: store },
        { provide: DailyRecordWriter, useValue: store },
        { provide: DailyEvolutionSource, useClass: EvolutionStub },
        { provide: PrescriptionSource, useValue: { load: (): Promise<readonly never[]> => Promise.resolve([]) } },
        { provide: ParameterAiStructurer, useValue: ai },
        { provide: EvolutionAiStructurer, useValue: { suggest: (): Promise<string> => Promise.resolve('') } },
        { provide: ConnectivityService, useValue: { online } },
        { provide: ProfessionalProfileReader, useValue: { read: (): object => ({ name: 'Michelle', role: 'other' }) } },
        { provide: NOW, useValue: (): Date => nowValue },
      ],
    });
    fixture = TestBed.createComponent(DailyRecordSheetComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('abre com título, fechar, catálogo inicial (rótulo, unidade, placeholder) e botão Salvar registro', async () => {
    await openIt();

    expect(dialog().open).toBeTrue();
    expect(el().querySelector('#daily-title')?.textContent).toContain('Registro diário');
    expect(el().querySelector('.daily__count')?.textContent).toContain('5');
    const labels = Array.from(el().querySelectorAll('.daily__label')).map(l => l.textContent.trim());

    expect(labels).toEqual([
      'Glicemia (mg/dL)',
      'Evacuações (evacuações)',
      'Débito de ileostomia (mL)',
      'Diurese (mL)',
      'Resultado laboratorial (valor)',
    ]);

    expect(input('glycemia').placeholder).toBe('Ex.: 132');
    expect(saveButton().textContent).toContain('Salvar registro');
    expect(loadSpy).toHaveBeenCalledWith('p1');
  });

  it('traz a seção Evolução médica dentro do sheet, lida ao abrir (perfil que não é médico só consulta)', async () => {
    await openIt();

    expect(el().querySelector('app-daily-evolution h3')?.textContent).toContain('Evolução médica');
    expect(el().querySelector('app-daily-evolution textarea')).toBeNull();
    expect(el().querySelector('[data-testid="evolution-empty"]')).not.toBeNull();
  });

  it('fecha pelo botão, pelo Esc e pelo scrim, e o dialog fecha junto', async () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    await openIt();
    (el().querySelector('app-icon-button button') as HTMLButtonElement).click();
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    dialog().click();
    el().querySelector<HTMLElement>('.daily__body')?.click();

    expect(closed).toHaveBeenCalledTimes(3);
    fixture.componentRef.setInput('open', false);
    await settle();

    expect(dialog().open).toBeFalse();
  });

  it('salvar grava o lançamento com valor, autor e data/hora e mostra o último lançamento no card', async () => {
    await openIt();
    type('glycemia', '132');
    await save();

    const [saved] = await store.loadEntries('p1');

    expect(saved).toEqual(jasmine.objectContaining({ author: 'Michelle', parameterId: 'glycemia', value: 132 }));
    expect(saved.at).toBe(TODAY.toISOString());
    expect(input('glycemia').value).toBe('');
    expect(help('glycemia')).toContain('Último lançamento: 132 às 12:00.');
    expect(el().textContent).toContain(SAVED_HINT);
    expect(help('diuresis')).toBe('Evacuações e débito de ileostomia seguem o mesmo card.');
  });

  it('aceita vírgula decimal e grava só os parâmetros preenchidos', async () => {
    await openIt();
    type('lab', '4,2');
    type('diuresis', '1200');
    await save();

    const all = await store.loadEntries('p1');

    expect(all.map(e => [e.parameterId, e.value])).toEqual([
      ['diuresis', 1200],
      ['lab', 4.2],
    ]);
  });

  it('salvar sem nenhum valor não grava e explica o motivo em texto', async () => {
    const spy = spyOn(store, 'record').and.callThrough();

    await openIt();
    type('glycemia', '   ');
    await save();

    expect(spy).not.toHaveBeenCalled();
    expect(el().querySelector('[role=alert]')?.textContent).toContain('Preencha o valor de ao menos um parâmetro');
  });

  it('valor não numérico mostra erro no campo, não grava nada e o erro some ao editar', async () => {
    const spy = spyOn(store, 'record').and.callThrough();

    await openIt();
    type('glycemia', 'abc');
    type('diuresis', '1200');
    await save();

    expect(spy).not.toHaveBeenCalled();
    expect(input('glycemia').getAttribute('aria-invalid')).toBe('true');
    expect(el().textContent).toContain('Informe um número válido');
    type('glycemia', '120');

    expect(el().textContent).not.toContain('Informe um número válido');
  });

  it('falha na gravação mantém os valores, avisa e "Tentar de novo" regrava', async () => {
    const spy = spyOn(store, 'record').and.rejectWith(new Error('x'));

    await openIt();
    type('glycemia', '132');
    await save();

    expect(input('glycemia').value).toBe('132');
    expect(el().querySelector('[role=alert]')?.textContent).toContain(SAVE_FAILED_HINT);
    expect(el().textContent).not.toContain(SAVED_HINT);
    spy.and.callThrough();
    (
      Array.from(el().querySelectorAll('button')).find(b => b.textContent.includes('Tentar de novo')) as HTMLElement
    ).click();
    await settle();

    expect((await store.loadEntries('p1')).length).toBe(1);
    expect(el().textContent).not.toContain(SAVE_FAILED_HINT);
  });

  it('offline: preencher continua possível, salvar fica desabilitado com aviso', async () => {
    online.set(false);
    await openIt();
    type('glycemia', '132');

    expect(input('glycemia').value).toBe('132');
    expect(saveButton().disabled).toBeTrue();
    expect(el().textContent).toContain(OFFLINE_SAVE_HINT);
  });

  it('lançamentos de hoje já gravados aparecem no card; os de outro dia não', async () => {
    await store.record('p1', [
      { at: at(8, 10), author: 'Ana', parameterId: 'glycemia', value: 118 },
      { at: new Date(2026, 4, 27, 20).toISOString(), author: 'Ana', parameterId: 'diuresis', value: 900 },
    ]);
    await openIt();

    expect(help('glycemia')).toContain('Último lançamento: 118 às 08:10.');
    expect(help('diuresis')).not.toContain('Último');
  });

  describe('histórico do dia (múltiplos lançamentos)', () => {
    const points = (id: string): string[] =>
      Array.from(el().querySelectorAll(`[aria-label="Histórico de hoje: ${id}"] li`)).map(li =>
        li.children.length === 0
          ? (li.textContent ?? '').trim()
          : Array.from(li.children)
              .map(c => (c.textContent ?? '').trim())
              .join(' '),
      );

    it('um segundo lançamento do mesmo parâmetro é acrescentado e o primeiro permanece', async () => {
      await store.record('p1', [{ at: at(8, 10), author: 'Ana', parameterId: 'glycemia', value: 118 }]);
      await openIt();
      type('glycemia', '132');
      await save();

      expect(points('Glicemia')).toEqual(['118 mg/dL Ana · 08:10', '132 mg/dL Michelle · 12:00']);
      expect((await store.loadEntries('p1')).length).toBe(2);
      expect(help('glycemia')).toContain('Último lançamento: 132 às 12:00.');
    });

    it('lista do mais antigo ao mais recente, mesmo com a gravação fora de ordem, e o último é o mais recente', async () => {
      await store.record('p1', [
        { at: at(11, 0), author: 'Ana', parameterId: 'glycemia', value: 150 },
        { at: at(7, 30), author: 'Bia', parameterId: 'glycemia', value: 100 },
        { at: at(9, 0), author: 'Caio', parameterId: 'glycemia', value: 120 },
      ]);
      await openIt();

      expect(points('Glicemia').map(p => p.split(' ')[0])).toEqual(['100', '120', '150']);
      expect(help('glycemia')).toContain('Último lançamento: 150 às 11:00.');
    });

    it('autores diferentes em instantes próximos aparecem como pontos separados', async () => {
      await store.record('p1', [
        { at: at(10, 0), author: 'Ana', parameterId: 'diuresis', value: 300 },
        { at: at(10, 0), author: 'Bia', parameterId: 'diuresis', value: 320 },
      ]);
      await openIt();

      expect(points('Diurese')).toEqual(['300 mL Ana · 10:00', '320 mL Bia · 10:00']);
    });

    it('parâmetro sem lançamentos hoje mostra o estado vazio próprio; outro dia não conta', async () => {
      await store.record('p1', [
        { at: new Date(2026, 4, 27, 20).toISOString(), author: 'Ana', parameterId: 'lab', value: 4 },
      ]);
      await openIt();

      expect(points('Resultado laboratorial')).toEqual(['Nenhum lançamento hoje.']);
    });
  });

  it('falha ao carregar os lançamentos avisa, mas o registro manual segue possível', async () => {
    loadSpy.and.callFake(() => Promise.reject(new Error('x')));
    await openIt();

    expect(el().textContent).toContain(LOAD_FAILED_HINT);
    type('glycemia', '132');
    await save();
    loadSpy.and.callThrough();

    expect((await store.loadEntries('p1')).length).toBe(1);
  });

  it('descarta a resposta de uma abertura anterior', async () => {
    let resolveFirst: ((v: readonly ParameterEntry[]) => void) | undefined;

    loadSpy.and.returnValues(
      new Promise<readonly ParameterEntry[]>(r => (resolveFirst = r)),
      Promise.resolve([{ at: at(9, 0), author: 'Ana', id: 'b', parameterId: 'glycemia', value: 100 }]),
    );
    await openIt();
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    await openIt();
    resolveFirst?.([{ at: at(7, 0), author: 'Ana', id: 'a', parameterId: 'glycemia', value: 50 }]);
    await settle();

    expect(help('glycemia')).toContain('Último lançamento: 100 às 09:00.');
  });

  describe('registro via IA (US-004-7-02)', () => {
    const chats = (): InputChatComponent[] =>
      fixture.debugElement
        .queryAll(By.directive(InputChatComponent))
        .map(d => d.componentInstance as InputChatComponent);
    const chatEl = (): import('@angular/core').DebugElement => fixture.debugElement.query(By.css('.daily__chat'));
    const narrate = async (result: readonly SuggestedParameter[] | Error): Promise<void> => {
      ai.result = result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
      chatEl().triggerEventHandler('audioSend', new Blob(['a']));
      await settle();
    };
    const notes = (): string[] => Array.from(el().querySelectorAll('.daily__ai-note')).map(n => n.textContent.trim());

    it('mostra o campo de áudio do desenho', async () => {
      await openIt();

      expect(chats().length).toBeGreaterThan(0);
      expect(chatEl().componentInstance.placeholder()).toBe('Grave um áudio com os valores do dia');
    });

    it('preenche cards de categorias diferentes (vírgula decimal) sem salvar e identifica em texto', async () => {
      const spy = spyOn(store, 'record').and.callThrough();

      await openIt();
      await narrate([
        { parameterId: 'glycemia', value: '132' },
        { label: 'resultado laboratorial', value: '4,2' },
      ]);

      expect(input('glycemia').value).toBe('132');
      expect(input('lab').value).toBe('4,2');
      expect(notes()).toEqual([AI_SUGGESTED_NOTE, AI_SUGGESTED_NOTE]);
      expect(spy).not.toHaveBeenCalled();
      expect((await store.loadEntries('p1')).length).toBe(0);
    });

    it('valor da IA continua editável e a nota some ao editar; apagado não é gravado', async () => {
      await openIt();
      await narrate([
        { parameterId: 'glycemia', value: '132' },
        { parameterId: 'diuresis', value: '900' },
      ]);
      type('glycemia', '140');
      type('diuresis', '');

      expect(notes()).toEqual([]);
      await save();

      expect((await store.loadEntries('p1')).map(e => [e.parameterId, e.value])).toEqual([['glycemia', 140]]);
    });

    it('avisa em texto quando a IA substitui um valor já digitado', async () => {
      await openIt();
      type('glycemia', '100');
      await narrate([{ parameterId: 'glycemia', value: '132' }]);

      expect(input('glycemia').value).toBe('132');
      expect(notes()[0]).toContain('Substituiu o valor digitado (100)');
    });

    it('sem nada reconhecido avisa e o formulário segue utilizável', async () => {
      await openIt();
      await narrate([]);

      expect(el().textContent).toContain(AI_EMPTY_HINT);
      type('glycemia', '120');
      await save();

      expect((await store.loadEntries('p1')).length).toBe(1);
    });

    it('IA com erro avisa e o preenchimento manual segue', async () => {
      await openIt();
      await narrate(new Error('x'));

      expect(el().textContent).toContain(AI_FAILED_HINT);
      type('glycemia', '120');
      await save();

      expect((await store.loadEntries('p1')).length).toBe(1);
    });

    it('microfone negado ou falha de gravação avisam em texto', async () => {
      await openIt();
      chatEl().triggerEventHandler('audioModeError', 'permission-denied');
      await settle();

      expect(el().textContent).toContain(AI_MIC_DENIED_HINT);
      chatEl().triggerEventHandler('audioModeError', 'recorder-failed');
      await settle();

      expect(el().textContent).toContain(AI_MIC_FAILED_HINT);
      expect(saveButton().disabled).toBeFalse();
    });

    it('offline: campo de áudio desabilitado, aviso, sem chamar a IA; manual continua', async () => {
      online.set(false);
      await openIt();

      expect(el().textContent).toContain(AI_UNAVAILABLE_HINT);
      expect(chatEl().componentInstance.disabled()).toBeTrue();
      type('glycemia', '132');

      expect(input('glycemia').value).toBe('132');
      expect(ai.calls).toBe(0);
    });

    it('ignora áudio enquanto offline ou já processando', async () => {
      await openIt();
      let finish: ((v: readonly SuggestedParameter[]) => void) | undefined;

      ai.result = new Promise(r => (finish = r));
      chatEl().triggerEventHandler('audioSend', new Blob(['a']));
      chatEl().triggerEventHandler('audioSend', new Blob(['b']));
      fixture.detectChanges();

      expect(ai.calls).toBe(1);
      expect(el().textContent).toContain('Processando o áudio');
      finish?.([{ parameterId: 'glycemia', value: '1' }]);
      await settle();

      expect(input('glycemia').value).toBe('1');
    });

    it('descarta a resposta se a conexão caiu ou a folha foi fechada/reaberta', async () => {
      await openIt();
      let finish: ((v: readonly SuggestedParameter[]) => void) | undefined;

      ai.result = new Promise(r => (finish = r));
      chatEl().triggerEventHandler('audioSend', new Blob(['a']));
      online.set(false);
      finish?.([{ parameterId: 'glycemia', value: '1' }]);
      await settle();

      expect(input('glycemia').value).toBe('');
      online.set(true);
      ai.result = new Promise(r => (finish = r));
      fixture.detectChanges();
      chatEl().triggerEventHandler('audioSend', new Blob(['a']));
      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
      await openIt();
      finish?.([{ parameterId: 'glycemia', value: '1' }]);
      await settle();

      expect(input('glycemia').value).toBe('');
    });

    it('descarta a falha de uma abertura anterior', async () => {
      await openIt();
      let fail: ((e: unknown) => void) | undefined;

      ai.result = new Promise((_, r) => (fail = r));
      chatEl().triggerEventHandler('audioSend', new Blob(['a']));
      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
      await openIt();
      fail?.(new Error('x'));
      await settle();

      expect(el().textContent).not.toContain(AI_FAILED_HINT);
    });

    it('fechar sem salvar descarta a sugestão: ao reabrir não reaparece nem foi gravada', async () => {
      await openIt();
      await narrate([
        { parameterId: 'glycemia', value: '132' },
        { label: 'Lactato', unit: 'mmol/L', value: '2,1' },
      ]);
      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
      await openIt();

      expect(input('glycemia').value).toBe('');
      expect(el().querySelectorAll('[data-testid="extra-card"]').length).toBe(0);
      expect((await store.loadEntries('p1')).length).toBe(0);
    });

    it('parâmetro fora do catálogo vira card extra editável e só é gravado ao confirmar', async () => {
      const spy = spyOn(store, 'record').and.callThrough();

      await openIt();
      await narrate([
        { label: 'Lactato', unit: 'mmol/L', value: '2,1' },
        { label: 'lactato', value: '2,5' },
      ]);

      expect(el().querySelectorAll('[data-testid="extra-card"]').length).toBe(1);
      expect(spy).not.toHaveBeenCalled();
      const name = el().querySelector('[id^="daily-name-"]') as HTMLInputElement;
      const unit = el().querySelector('[id^="daily-unit-"]') as HTMLInputElement;

      expect(name.value).toBe('Lactato');
      expect(unit.value).toBe('mmol/L');
      name.value = 'Lactato arterial';
      name.dispatchEvent(new Event('input'));
      unit.value = 'mg/dL';
      unit.dispatchEvent(new Event('input'));
      await save();

      const [entry] = await store.loadEntries('p1');

      expect(entry).toEqual(
        jasmine.objectContaining({
          author: 'Michelle',
          parameterId: 'custom:lactato-arterial',
          parameterLabel: 'Lactato arterial',
          unit: 'mg/dL',
          value: 2.5,
        }),
      );
      // Passa a ser um card do catálogo da sessão, com histórico.
      expect(el().querySelectorAll('[data-testid="extra-card"]').length).toBe(0);
      expect(el().textContent).toContain('Lactato arterial (mg/dL)');
      expect(el().textContent).toContain('2,5 mg/dL');
    });

    it('card extra sem nome impede a gravação; a IA reutiliza o card gravado na reabertura', async () => {
      const spy = spyOn(store, 'record').and.callThrough();

      await openIt();
      await narrate([{ value: '3' }]);
      await save();

      expect(spy).not.toHaveBeenCalled();
      expect(el().textContent).toContain(EXTRA_NAME_REQUIRED_HINT);
      const name = el().querySelector('[id^="daily-name-"]') as HTMLInputElement;

      name.value = 'Sódio';
      name.dispatchEvent(new Event('input'));
      await save();
      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
      await openIt();

      expect(el().textContent).toContain('Sódio ()');
      await narrate([{ label: 'sodio', value: '140' }]);

      expect(el().querySelectorAll('[data-testid="extra-card"]').length).toBe(0);
      expect(el().textContent).toContain('3 ');
    });

    it('valor inválido da IA mostra o mesmo erro da digitação e impede a gravação até corrigir', async () => {
      const spy = spyOn(store, 'record').and.callThrough();

      await openIt();
      await narrate([{ parameterId: 'glycemia', value: 'cento e trinta' }]);

      expect(el().textContent).toContain('Informe um número válido');
      await save();

      expect(spy).not.toHaveBeenCalled();
      type('glycemia', '130');
      await save();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('falha na gravação mantém os valores sugeridos e "Tentar de novo" regrava', async () => {
      const spy = spyOn(store, 'record').and.rejectWith(new Error('x'));

      await openIt();
      await narrate([
        { parameterId: 'glycemia', value: '132' },
        { label: 'Lactato', value: '2' },
      ]);
      await save();

      expect(input('glycemia').value).toBe('132');
      expect(el().querySelectorAll('[data-testid="extra-card"]').length).toBe(1);
      expect(el().textContent).toContain(SAVE_FAILED_HINT);
      spy.and.callThrough();
      (
        Array.from(el().querySelectorAll('button')).find(b => b.textContent.includes('Tentar de novo')) as HTMLElement
      ).click();
      await settle();

      expect((await store.loadEntries('p1')).length).toBe(2);
    });
  });

  it('descarta a falha de uma abertura anterior', async () => {
    let rejectFirst: ((e: unknown) => void) | undefined;

    loadSpy.and.returnValues(new Promise<readonly ParameterEntry[]>((_, r) => (rejectFirst = r)), Promise.resolve([]));
    await openIt();
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    await openIt();
    rejectFirst?.(new Error('x'));
    await settle();

    expect(el().textContent).not.toContain(LOAD_FAILED_HINT);
  });
});
