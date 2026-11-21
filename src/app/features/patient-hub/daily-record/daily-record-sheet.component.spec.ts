import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { ParameterEntry } from './daily-record.models';
import {
  DailyRecordSheetComponent,
  LOAD_FAILED_HINT,
  OFFLINE_SAVE_HINT,
  SAVE_FAILED_HINT,
  SAVED_HINT,
} from './daily-record-sheet.component';
import { DailyRecordSource } from './daily-record-source';
import { DailyRecordWriter } from './daily-record-writer';
import { ProvisionalDailyRecordSource } from './provisional-daily-record-source';

const TODAY = new Date(2026, 4, 28, 12, 0);

describe('DailyRecordSheetComponent', () => {
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
    online = signal(true);
    nowValue = TODAY;
    loadSpy = spyOn(store, 'loadEntries').and.callThrough();
    TestBed.configureTestingModule({
      providers: [
        { provide: DailyRecordSource, useValue: store },
        { provide: DailyRecordWriter, useValue: store },
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
