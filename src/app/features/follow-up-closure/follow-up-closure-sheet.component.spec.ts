import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import {
  FollowUpClosure,
  FollowUpClosureRequest,
  FollowUpReopening,
  FollowUpReopeningRequest,
} from './follow-up-closure.models';
import { FollowUpClosureSheetComponent } from './follow-up-closure-sheet.component';
import { FollowUpClosureWriter } from './follow-up-closure-source';

class FakeWriter extends FollowUpClosureWriter {
  requests: FollowUpClosureRequest[] = [];
  fail = false;

  close(request: FollowUpClosureRequest): Promise<FollowUpClosure> {
    if (this.fail) {
      return Promise.reject(new Error('falhou'));
    }
    this.requests.push(request);

    return Promise.resolve({ ...request, id: 'c1' });
  }

  reopen(request: FollowUpReopeningRequest): Promise<FollowUpReopening> {
    return Promise.resolve({ ...request, id: 'r1' });
  }
}

describe('FollowUpClosureSheetComponent', () => {
  const TODAY = new Date(2026, 10, 21, 15, 30);
  let fixture: ComponentFixture<FollowUpClosureSheetComponent>;
  let writer: FakeWriter;
  let online: WritableSignal<boolean>;
  let saved: FollowUpClosure[];
  let closed: number;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const buttonByLabel = (label: string): HTMLButtonElement | undefined =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.trim() === label);
  const click = async (label: string): Promise<void> => {
    buttonByLabel(label)?.click();
    await settle();
  };
  const radios = (): HTMLInputElement[] => Array.from(el().querySelectorAll<HTMLInputElement>('input[type=radio]'));
  const pick = async (index: number): Promise<void> => {
    radios()[index].click();
    await settle();
  };
  const dateInput = (): HTMLInputElement => el().querySelector('#closure-date') as HTMLInputElement;
  const setDate = async (value: string): Promise<void> => {
    dateInput().value = value;
    dateInput().dispatchEvent(new Event('input'));
    await settle();
  };

  beforeEach(async () => {
    writer = new FakeWriter();
    online = signal(true);
    saved = [];
    closed = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: FollowUpClosureWriter, useValue: writer },
        { provide: ConnectivityService, useValue: { online } },
        { provide: ProfessionalProfileReader, useValue: { read: (): object => ({ name: 'Michelle', role: 'other' }) } },
        { provide: NOW, useValue: (): Date => TODAY },
      ],
    });
    fixture = TestBed.createComponent(FollowUpClosureSheetComponent);
    fixture.componentRef.setInput('patient', { bed: '31', id: 'p1', name: 'Lucas Henrique', ward: 'Ala 1' });
    fixture.componentInstance.saved.subscribe(c => saved.push(c));
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.componentRef.setInput('open', true);
    await settle();
  });

  afterEach(() => fixture.destroy());

  it('abre com o paciente em contexto, as 4 opções de motivo e a data de hoje', () => {
    expect(el().querySelector('dialog')?.open).toBeTrue();
    expect(el().textContent).toContain('Lucas Henrique');
    expect(el().textContent).toContain('Ala 1 · Leito 31');
    expect(radios()).toHaveSize(4);
    expect(el().textContent).toContain('Alta da EMTN');
    expect(el().textContent).toContain('Segue internado');
    expect(dateInput().value).toBe('2026-11-21');
    expect(dateInput().max).toBe('2026-11-21');
  });

  it('não aplica sem motivo: mostra o erro em texto e não pede confirmação', async () => {
    await click('Encerrar acompanhamento');

    expect(el().textContent).toContain('Escolha o motivo');
    expect(el().querySelector('#closure-confirm-title')).toBeNull();
    expect(writer.requests).toEqual([]);
  });

  it('recusa data futura com mensagem em texto', async () => {
    await pick(1);
    await setDate('2026-11-25');
    await click('Encerrar acompanhamento');

    expect(el().textContent).toContain('não pode ser futura');
    expect(el().querySelector('#closure-confirm-title')).toBeNull();
  });

  it('exige confirmação explícita: o 1º clique só revisa, o 2º grava', async () => {
    await pick(1);
    await click('Encerrar acompanhamento');

    expect(writer.requests).toEqual([]);
    expect(el().querySelector('#closure-confirm-title')).not.toBeNull();
    expect(el().textContent).toContain('Óbito em 21/11/2026');

    await click('Confirmar encerramento');

    expect(writer.requests).toEqual([
      {
        at: TODAY.toISOString(),
        author: 'Michelle',
        effectiveDate: '2026-11-21',
        patientId: 'p1',
        reason: 'death',
      },
    ]);

    expect(saved).toHaveSize(1);
    expect(closed).toBe(1);
  });

  it('aceita data passada e voltar da revisão devolve à edição', async () => {
    await pick(0);
    await setDate('2026-11-18');
    await click('Encerrar acompanhamento');
    await click('Voltar');

    expect(el().querySelector('#closure-confirm-title')).toBeNull();
    await click('Encerrar acompanhamento');
    await click('Confirmar encerramento');

    expect(writer.requests[0].effectiveDate).toBe('2026-11-18');
  });

  it('mudar motivo ou data depois de revisar desfaz a confirmação', async () => {
    await pick(0);
    await click('Encerrar acompanhamento');
    await pick(2);

    expect(el().querySelector('#closure-confirm-title')).toBeNull();
    await click('Encerrar acompanhamento');
    await setDate('2026-11-20');

    expect(el().querySelector('#closure-confirm-title')).toBeNull();
  });

  it('sem conexão: confirmar fica indisponível e mostra "conexão necessária"', async () => {
    online.set(false);
    await settle();

    expect(el().textContent).toContain('Conexão necessária');
    expect(buttonByLabel('Encerrar acompanhamento')?.disabled).toBeTrue();
  });

  it('perder a conexão na revisão bloqueia a confirmação e nada é gravado', async () => {
    await pick(0);
    await click('Encerrar acompanhamento');
    online.set(false);
    await settle();

    expect(buttonByLabel('Confirmar encerramento')?.disabled).toBeTrue();
    await (fixture.componentInstance as unknown as { confirm(): Promise<void> }).confirm();

    expect(writer.requests).toEqual([]);
  });

  it('falha ao gravar mantém o modal aberto, avisa em texto e permite tentar de novo', async () => {
    writer.fail = true;
    await pick(0);
    await click('Encerrar acompanhamento');
    await click('Confirmar encerramento');

    expect(el().textContent).toContain('Não foi possível encerrar');
    expect(saved).toEqual([]);
    expect(closed).toBe(0);

    writer.fail = false;
    await click('Confirmar encerramento');

    expect(saved).toHaveSize(1);
  });

  it('fecha pelo X, pelo Esc e pelo scrim; reabrir começa limpo', async () => {
    await pick(3);
    el().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.click();
    await settle();
    const dialog = el().querySelector('dialog') as HTMLDialogElement;

    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    dialog.click();
    el()
      .querySelector('h2')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(closed).toBe(3);

    fixture.componentRef.setInput('open', false);
    await settle();

    expect(dialog.open).toBeFalse();
    fixture.componentRef.setInput('open', true);
    await settle();

    expect(radios().every(r => !r.checked)).toBeTrue();
    expect(dateInput().value).toBe('2026-11-21');
  });
});
