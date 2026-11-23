import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { Observation, ObservationSuggestions } from './observation.models';
import { ObservationFollowUpComponent } from './observation-follow-up.component';
import {
  DirectedMessageWriter,
  ObservationSuggester,
  PatientTeamSource,
  ReevaluationWriter,
} from './observation-source';
import { ProvisionalObservationStore, ProvisionalPatientTeamSource } from './provisional-observation';

const OBS: Observation = {
  at: 't',
  author: 'Michelle',
  authorGroup: 'medicos',
  id: 'obs-1',
  patientId: 'p1',
  text: 'Diarreia há 48 horas',
};
const BOTH: ObservationSuggestions = {
  communication: { draft: 'Solicito reforço dos cuidados.', group: 'enfermagem' },
  reevaluation: { dueDate: '2026-11-24', reason: 'Diarreia há 48 horas' },
};

describe('ObservationFollowUpComponent', () => {
  let fixture: ComponentFixture<ObservationFollowUpComponent>;
  let store: ProvisionalObservationStore;
  let suggestions: ObservationSuggestions | null;
  let online: WritableSignal<boolean>;
  let changes: number;
  let closes: number;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.trim() === label);
  const click = async (label: string): Promise<void> => {
    button(label)?.click();
    await settle();
  };
  const open = async (observation: Observation | null = OBS): Promise<void> => {
    fixture.componentRef.setInput('observation', observation);
    await settle();
    await settle();
  };

  beforeEach(() => {
    store = new ProvisionalObservationStore();
    suggestions = BOTH;
    online = signal(true);
    changes = 0;
    closes = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: ReevaluationWriter, useValue: store },
        { provide: DirectedMessageWriter, useValue: store },
        { provide: PatientTeamSource, useClass: ProvisionalPatientTeamSource },
        {
          provide: ObservationSuggester,
          useValue: {
            suggest: (): Promise<ObservationSuggestions> =>
              suggestions === null ? Promise.reject(new Error('ia')) : Promise.resolve(suggestions),
          },
        },
        { provide: ConnectivityService, useValue: { online } },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): object => ({ name: 'Michelle', role: 'doctor' }) },
        },
        { provide: NOW, useValue: (): Date => new Date(2026, 10, 23, 9) },
      ],
    });
    fixture = TestBed.createComponent(ObservationFollowUpComponent);
    fixture.componentInstance.changed.subscribe(() => changes++);
    fixture.componentInstance.closed.subscribe(() => closes++);
  });

  it('oferece a pendência com prazo e destinatário padrão, sem criar nada antes da confirmação', async () => {
    await open();

    expect(el().textContent).toContain('Criar pendência de reavaliação?');
    expect(el().textContent).toContain('24/11/2026');
    expect(el().textContent).toContain('@medicos');
    expect(await store.list('p1')).toEqual([]);
  });

  it('aceitar sem alterar cria a pendência com o grupo do autor e registra autor e data/hora', async () => {
    await open();
    await click('Criar pendência');

    const [item] = await store.list('p1');

    expect(item.recipients).toEqual({ group: 'medicos', people: [] });
    expect(item.author).toBe('Michelle');
    expect(item.createdAt).toContain('2026-11-23');
    expect(item.observationId).toBe('obs-1');
    expect(el().textContent).toContain('Pendência criada');
    expect(changes).toBe(1);
  });

  it('grupo padrão sem vinculados: avisa e não cria', async () => {
    await open({ ...OBS, authorGroup: 'fisio' });

    expect(el().textContent).toContain('Não há destinatário válido');
    expect(button('Criar pendência')?.disabled).toBeTrue();
    await click('Criar pendência');

    expect(await store.list('p1')).toEqual([]);
  });

  it('permite trocar o grupo e adicionar pessoas antes de criar', async () => {
    await open();
    const select = el().querySelector<HTMLSelectElement>('#followup-reev-rcp-group') as HTMLSelectElement;

    select.value = 'nutris';
    select.dispatchEvent(new Event('change'));
    await settle();
    const box = el().querySelectorAll<HTMLInputElement>('app-recipients-editor input[type=checkbox]')[4];

    box.click();
    await settle();
    box.click();
    await settle();
    box.click();
    await settle();
    await click('Criar pendência');

    const [item] = await store.list('p1');

    expect(item.recipients.group).toBe('nutris');
    expect(item.recipients.people.map(p => p.name)).toEqual(['Almira Borges Pereira']);
  });

  it('o rascunho é editável e o envio usa o texto editado, só após confirmar', async () => {
    await open();
    const area = el().querySelector<HTMLTextAreaElement>('#followup-draft') as HTMLTextAreaElement;

    expect(area.value).toBe('Solicito reforço dos cuidados.');
    expect(await store.listMessages('p1')).toEqual([]);
    area.value = 'Texto ajustado pelo profissional';
    area.dispatchEvent(new Event('input'));
    await settle();
    await click('Enviar mensagem');

    const [message] = await store.listMessages('p1');

    expect(message.text).toBe('Texto ajustado pelo profissional');
    expect(message.recipients.group).toBe('enfermagem');
    expect(message.author).toBe('Michelle');
    expect(el().textContent).toContain('Mensagem enviada');
  });

  it('rascunho vazio ou grupo sem vinculados impede o envio', async () => {
    await open();
    const area = el().querySelector<HTMLTextAreaElement>('#followup-draft') as HTMLTextAreaElement;

    area.value = '   ';
    area.dispatchEvent(new Event('input'));
    await settle();

    expect(button('Enviar mensagem')?.disabled).toBeTrue();

    suggestions = { communication: { draft: 'x', group: 'fisio' }, reevaluation: null };
    await open(null);
    await open({ ...OBS, id: 'obs-2' });

    expect(el().textContent).toContain('Não há destinatário válido');
    expect(button('Enviar mensagem')?.disabled).toBeTrue();
  });

  it('recusa exige confirmação e não cria nem envia nada; Voltar cancela a recusa', async () => {
    await open();
    await click('Recusar as duas sugestões');

    expect(el().textContent).toContain('Confirmar a recusa?');
    await click('Voltar');

    expect(el().textContent).not.toContain('Confirmar a recusa?');
    await click('Recusar as duas sugestões');
    await click('Confirmar recusa');

    expect(await store.list('p1')).toEqual([]);
    expect(await store.listMessages('p1')).toEqual([]);
    expect(changes).toBe(0);
    expect(el().textContent).toContain('nenhuma pendência foi criada');
    expect(el().textContent).toContain('nenhuma mensagem foi enviada');
    await click('Concluir');

    expect(closes).toBe(1);
  });

  it('aceita uma sugestão e recusa a outra, em qualquer ordem', async () => {
    await open();
    await click('Recusar comunicação');
    await click('Confirmar recusa');
    await click('Criar pendência');

    expect((await store.list('p1')).length).toBe(1);
    expect(await store.listMessages('p1')).toEqual([]);

    await open(null);
    await open({ ...OBS, id: 'obs-3' });
    await click('Recusar pendência');
    await click('Confirmar recusa');
    await click('Enviar mensagem');

    expect((await store.list('p1')).length).toBe(1);
    expect((await store.listMessages('p1')).length).toBe(1);
  });

  it('sem IA ou sem sugestão, nada é exibido e o diálogo é fechado', async () => {
    suggestions = null;
    await open();

    expect(el().querySelector('dialog')?.open).toBeFalse();
    expect(closes).toBe(1);

    suggestions = { communication: null, reevaluation: null };
    await open(null);
    await open({ ...OBS, id: 'obs-4' });

    expect(el().querySelector('dialog')?.open).toBeFalse();
    expect(closes).toBe(2);
  });

  it('offline desabilita criar e enviar', async () => {
    online.set(false);
    await open();

    expect(el().textContent).toContain('Sem conexão');
    expect(button('Criar pendência')?.disabled).toBeTrue();
    expect(button('Enviar mensagem')?.disabled).toBeTrue();
    await click('Criar pendência');

    expect(await store.list('p1')).toEqual([]);
  });

  it('falha ao gravar mostra o aviso e mantém a sugestão pendente', async () => {
    spyOn(store, 'create').and.rejectWith(new Error('x'));
    spyOn(store, 'send').and.rejectWith(new Error('x'));
    await open();
    await click('Criar pendência');

    expect(el().querySelector('[role=alert]')?.textContent).toContain('Não foi possível salvar');
    expect(button('Criar pendência')).toBeDefined();
    await click('Enviar mensagem');

    expect(changes).toBe(0);
  });

  it('Esc e o botão fechar encerram o diálogo', async () => {
    await open();
    el()
      .querySelector('dialog')
      ?.dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(closes).toBe(1);
    (el().querySelector('app-icon-button button') as HTMLButtonElement).click();

    expect(closes).toBe(2);
  });
});
