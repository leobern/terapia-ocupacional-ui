import { HttpErrorResponse } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW } from '../../home/professional-profile';
import { ObservationFollowUpComponent, toDateInput } from './observation-follow-up.component';
import { ObservationFollowUpPort, RecordSuggestions } from './observation-follow-up.port';
import { PatientRecord } from './patient-message.models';
import { PatientTeamSource } from './patient-message-source';

const RECORD: PatientRecord = {
  at: '2026-11-25T10:00:00.000Z',
  author: 'Ana',
  content: 'SNE exteriorizada',
  id: '90',
  patientId: '7',
  recipients: [],
  viaAudio: false,
};

const NURSE = { id: 5, name: 'Almira', specialty: 'Enfermeira' };
const DOCTOR = { id: 4, name: 'Michelle', specialty: 'Médica' };

const FULL: RecordSuggestions = {
  comunicacao: {
    draft: 'Reposicionar a SNE.',
    resolvedRecipients: [NURSE],
    suggestedRecipients: [{ perfil: 'Enfermeira', type: 'GRUPO' }],
  },
  pendencia: {
    defaultRecipients: [{ perfil: 'Médica', type: 'GRUPO' }],
    rationale: 'Reavaliar a sonda.',
    resolvedRecipients: [DOCTOR],
    suggestedDueAt: '2026-11-27T12:00:00.000Z',
  },
};

class FakePort extends ObservationFollowUpPort {
  suggestionsResult: Promise<RecordSuggestions> = Promise.resolve(FULL);
  failActions: unknown = null;
  readonly pending: unknown[][] = [];
  readonly messages: unknown[][] = [];

  suggestions(): Promise<RecordSuggestions> {
    return this.suggestionsResult;
  }

  createPending(...args: unknown[]): Promise<void> {
    this.pending.push(args);

    return this.failActions === null ? Promise.resolve() : Promise.reject(this.failActions);
  }

  sendCommunication(...args: unknown[]): Promise<void> {
    this.messages.push(args);

    return this.failActions === null ? Promise.resolve() : Promise.reject(this.failActions);
  }

  changePendingRecipients(): Promise<void> {
    return Promise.resolve();
  }
}

describe('ObservationFollowUpComponent', () => {
  let fixture: ComponentFixture<ObservationFollowUpComponent>;
  let port: FakePort;
  let online: WritableSignal<boolean>;
  let closed: number;
  let changed: number;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dialog = (): HTMLDialogElement => el().querySelector('dialog') as HTMLDialogElement;
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const button = (label: string): HTMLButtonElement =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.trim() === label) as HTMLButtonElement;
  const click = async (label: string): Promise<void> => {
    button(label).click();
    await settle();
  };
  const open = async (): Promise<void> => {
    fixture.componentRef.setInput('record', RECORD);
    fixture.detectChanges();
    await settle();
  };

  beforeEach(() => {
    port = new FakePort();
    online = signal(true);
    closed = 0;
    changed = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: ObservationFollowUpPort, useValue: port },
        {
          provide: PatientTeamSource,
          useValue: {
            listLinked: (): Promise<unknown[]> =>
              Promise.resolve([
                { ...NURSE, group: 'nurses' },
                { ...DOCTOR, group: 'doctors' },
              ]),
          },
        },
        { provide: ConnectivityService, useValue: { online } },
        { provide: NOW, useValue: (): Date => new Date(2026, 10, 25, 9, 0) },
      ],
    });
    fixture = TestBed.createComponent(ObservationFollowUpComponent);
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.componentInstance.changed.subscribe(() => changed++);
    fixture.detectChanges();
  });

  it('fechado sem observação', () => {
    expect(dialog().open).toBeFalse();
  });

  it('abre com as duas sugestões e o prazo sugerido', async () => {
    await open();

    expect(dialog().open).toBeTrue();
    expect(el().querySelector('[data-testid="pending-card"]')?.textContent).toContain('Reavaliar a sonda.');
    expect((el().querySelector('#follow-up-draft') as HTMLTextAreaElement).value).toBe('Reposicionar a SNE.');
    expect((el().querySelector('#follow-up-due') as HTMLInputElement).value).toBe(
      toDateInput(new Date(FULL.pendencia?.suggestedDueAt ?? '')),
    );
  });

  it('IA/backend indisponível ou sem sugestão: nem abre e avisa o fechamento', async () => {
    port.suggestionsResult = Promise.reject(new Error('indisponível'));
    await open();

    expect(dialog().open).toBeFalse();
    expect(closed).toBe(1);

    port.suggestionsResult = Promise.resolve({ comunicacao: null, pendencia: null });
    fixture.componentRef.setInput('record', { ...RECORD, id: '91' });
    await settle();

    expect(dialog().open).toBeFalse();
    expect(closed).toBe(2);
  });

  it('cria a pendência com o padrão do backend (sem destinatários) e o prazo sugerido', async () => {
    await open();
    await click('Criar pendência');

    expect(port.pending).toEqual([['7', '90', '2026-11-27T12:00:00.000Z', null]]);
    expect(changed).toBe(1);
    expect(el().querySelector('[data-testid="pending-outcome"]')?.textContent).toContain('criada');
    expect(dialog().open).toBeTrue();
  });

  it('destinatário alterado e prazo ajustado vão como pessoas e fim do dia', async () => {
    await open();
    const due = el().querySelector('#follow-up-due') as HTMLInputElement;

    due.value = '2026-12-01';
    due.dispatchEvent(new Event('input'));
    (
      el().querySelector('[data-testid="pending-card"] input[type="checkbox"]:not(:checked)') as HTMLInputElement
    ).click();
    await settle();
    await click('Criar pendência');

    expect(port.pending[0][2]).toBe(new Date('2026-12-01T23:59:00').toISOString());
    expect(port.pending[0][3]).toEqual([
      { professionalId: 4, type: 'PESSOA' },
      { professionalId: 5, type: 'PESSOA' },
    ]);
  });

  it('prazo no passado e sem destinatário bloqueiam a criação', async () => {
    await open();
    const due = el().querySelector('#follow-up-due') as HTMLInputElement;

    due.value = '2026-11-20';
    due.dispatchEvent(new Event('input'));
    await settle();

    expect(button('Criar pendência').disabled).toBeTrue();
    expect(el().textContent).toContain('O prazo deve ser hoje ou uma data futura.');

    due.value = '2026-11-28';
    due.dispatchEvent(new Event('input'));
    (el().querySelector('[data-testid="pending-card"] input[type="checkbox"]:checked') as HTMLInputElement).click();
    await settle();

    expect(button('Criar pendência').disabled).toBeTrue();
    expect(el().textContent).toContain('Escolha ao menos um destinatário');
  });

  it('envia a mensagem com o texto editado e os destinatários sugeridos', async () => {
    await open();
    const draft = el().querySelector('#follow-up-draft') as HTMLTextAreaElement;

    draft.value = '  Reposicionar a SNE agora.  ';
    draft.dispatchEvent(new Event('input'));
    await settle();
    await click('Enviar mensagem');

    expect(port.messages).toEqual([
      ['7', '90', 'Reposicionar a SNE agora.', [{ perfil: 'Enfermeira', type: 'GRUPO' }]],
    ]);

    expect(el().querySelector('[data-testid="communication-outcome"]')?.textContent).toContain('enviada');
  });

  it('mensagem com destinatário alterado vai como PESSOA; rascunho vazio bloqueia o envio', async () => {
    await open();
    (
      el().querySelector('[data-testid="communication-card"] input[type="checkbox"]:checked') as HTMLInputElement
    ).click();
    await settle();

    expect(button('Enviar mensagem').disabled).toBeTrue();

    Array.from(el().querySelectorAll<HTMLInputElement>('[data-testid="communication-card"] input[type="checkbox"]'))
      .at(-1)
      ?.click();
    await settle();
    await click('Enviar mensagem');

    expect(port.messages[0][3]).toEqual([{ professionalId: 4, type: 'PESSOA' }]);
  });

  it('recusar não chama a API; recusar tudo fecha', async () => {
    await open();
    await click('Recusar pendência');

    expect(el().querySelector('[data-testid="pending-outcome"]')?.textContent).toContain('recusada');
    await click('Recusar mensagem');

    expect(port.pending).toEqual([]);
    expect(port.messages).toEqual([]);
    expect(closed).toBe(1);
  });

  it('recusar as duas de uma vez fecha o diálogo', async () => {
    await open();
    await click('Recusar as duas sugestões');

    expect(closed).toBe(1);
    expect(port.pending.length + port.messages.length).toBe(0);
  });

  it('falha mantém tudo pendente e avisa; 409 diz que já existe pendência', async () => {
    await open();
    port.failActions = new HttpErrorResponse({ status: 500 });
    await click('Criar pendência');

    expect(el().textContent).toContain('Nada foi criado ou enviado');
    expect(changed).toBe(0);

    port.failActions = new HttpErrorResponse({ status: 409 });
    await click('Criar pendência');

    expect(el().textContent).toContain('já tem uma pendência');

    port.failActions = new HttpErrorResponse({ status: 409 });
    await click('Enviar mensagem');

    expect(el().textContent).toContain('Nada foi criado ou enviado');
  });

  it('offline desabilita criar e enviar', async () => {
    online.set(false);
    await open();

    expect(button('Criar pendência').disabled).toBeTrue();
    expect(button('Enviar mensagem').disabled).toBeTrue();
    expect(el().textContent).toContain('Sem conexão');
  });

  it('só a comunicação sugerida: concluir fecha; Esc e clique no fundo fecham', async () => {
    port.suggestionsResult = Promise.resolve({ comunicacao: FULL.comunicacao, pendencia: null });
    await open();
    await click('Enviar mensagem');

    expect(closed).toBe(1);

    fixture.componentRef.setInput('record', { ...RECORD, id: '92' });
    await settle();
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    dialog().click();
    await settle();

    expect(closed).toBe(3);
  });

  it('só a pendência sugerida: concluir fecha', async () => {
    port.suggestionsResult = Promise.resolve({ comunicacao: null, pendencia: FULL.pendencia });
    await open();
    await click('Criar pendência');

    expect(closed).toBe(1);
  });

  it('ignora a resposta de uma observação anterior', async () => {
    const gate = Promise.withResolvers<RecordSuggestions>();

    port.suggestionsResult = gate.promise;
    fixture.componentRef.setInput('record', RECORD);
    fixture.detectChanges();
    fixture.componentRef.setInput('record', null);
    fixture.detectChanges();
    gate.resolve(FULL);
    await settle();

    expect(dialog().open).toBeFalse();
  });
});
