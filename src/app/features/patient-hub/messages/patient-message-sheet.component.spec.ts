import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { InputChatComponent } from '../../../shared/components/input-chat/input-chat.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { LinkedProfessional, PatientRecord, PatientRecordRequest, ProfessionalGroup } from './patient-message.models';
import {
  AI_EMPTY_AUDIO_HINT,
  AI_FAILED_AUDIO_HINT,
  AI_UNAVAILABLE_HINT,
  MIC_DENIED_HINT,
  MIC_FAILED_HINT,
  PatientMessageSheetComponent,
  TEAM_FAILED_HINT,
  TRANSCRIBED_NOTE,
} from './patient-message-sheet.component';
import { MessageAiAssistant, PatientMessageSource, PatientTeamSource } from './patient-message-source';

const TEAM: readonly LinkedProfessional[] = [
  { group: 'doctors', id: 1, name: 'Rafael Dutra', specialty: 'Nutrólogo' },
  { group: 'nurses', id: 5, name: 'Almira Borges', specialty: 'Enfermeira' },
  { group: 'nutritionists', id: 2, name: 'Filippa Martins', specialty: 'Nutricionista' },
];

class FakeSource extends PatientMessageSource {
  sent: PatientRecordRequest[] = [];
  fail = false;

  list(): Promise<readonly PatientRecord[]> {
    return Promise.resolve([]);
  }

  send(request: PatientRecordRequest): Promise<PatientRecord> {
    if (this.fail) {
      return Promise.reject(new Error('falhou'));
    }
    this.sent.push(request);

    return Promise.resolve({ ...request, id: 'm1' });
  }
}

class FakeTeam extends PatientTeamSource {
  fail = false;

  listLinked(): Promise<readonly LinkedProfessional[]> {
    return this.fail ? Promise.reject(new Error('x')) : Promise.resolve(TEAM);
  }
}

class FakeAi extends MessageAiAssistant {
  text: Promise<string> = Promise.resolve('');
  groups: Promise<readonly ProfessionalGroup[]> = Promise.resolve([]);
  suggestCalls = 0;

  transcribe(): Promise<string> {
    return this.text;
  }

  suggestGroups(): Promise<readonly ProfessionalGroup[]> {
    this.suggestCalls++;

    return this.groups;
  }
}

describe('PatientMessageSheetComponent', () => {
  let fixture: ComponentFixture<PatientMessageSheetComponent>;
  let source: FakeSource;
  let team: FakeTeam;
  let ai: FakeAi;
  let online: WritableSignal<boolean>;
  let sentEvents: PatientRecord[];
  let closedCount: number;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => el().textContent;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(el().querySelectorAll('app-button button')).find(b => b.textContent.includes(label)) as
      HTMLButtonElement | undefined;
  const click = async (label: string): Promise<void> => {
    button(label)?.click();
    await settle();
  };
  const type = async (value: string): Promise<void> => {
    const area = el().querySelector('#msg-content') as HTMLTextAreaElement;

    area.value = value;
    area.dispatchEvent(new Event('input'));
    await settle();
  };
  const chat = (): { triggerEventHandler: (name: string, value: unknown) => void } =>
    fixture.debugElement.query(By.directive(InputChatComponent));
  const entryLabels = (): string[] =>
    Array.from(el().querySelectorAll('.msg__entry-label')).map(e => e.textContent.replace(/\s+/g, ' ').trim());

  beforeEach(async () => {
    source = new FakeSource();
    team = new FakeTeam();
    ai = new FakeAi();
    online = signal(true);
    sentEvents = [];
    closedCount = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: PatientMessageSource, useValue: source },
        { provide: PatientTeamSource, useValue: team },
        { provide: MessageAiAssistant, useValue: ai },
        { provide: ConnectivityService, useValue: { online } },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): object => ({ name: 'Michelle', role: 'doctor' }) },
        },
        { provide: NOW, useValue: (): Date => new Date('2026-11-21T10:00:00.000Z') },
      ],
    });
    fixture = TestBed.createComponent(PatientMessageSheetComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentInstance.sent.subscribe(r => sentEvents.push(r));
    fixture.componentInstance.closed.subscribe(() => closedCount++);
    fixture.componentRef.setInput('open', true);
    await settle();
  });

  afterEach(() => fixture.destroy());

  it('abre o diálogo no passo de descrever, sem formulário alternativo', () => {
    expect((el().querySelector('dialog') as HTMLDialogElement).open).toBeTrue();
    expect(text()).toContain('Descreva a situação do paciente');
  });

  it('sem conteúdo não avança', async () => {
    await click('Revisar destinatários');

    expect(text()).toContain('Descreva a situação antes de continuar.');
  });

  it('observação sem destinatário: pede confirmação e grava sem destinatários', async () => {
    await type('dieta interrompida por realização de tomografia');
    await click('Revisar destinatários');

    expect(text()).toContain('sem notificar ninguém');
    expect(source.sent.length).toBe(0);

    await click('Registrar observação');

    expect(source.sent).toEqual([
      {
        at: '2026-11-21T10:00:00.000Z',
        author: 'Michelle',
        content: 'dieta interrompida por realização de tomografia',
        patientId: 'p1',
        recipients: [],
        viaAudio: false,
      },
    ]);

    expect(sentEvents.length).toBe(1);
    expect(closedCount).toBe(1);
  });

  it('destinatário mencionado é exibido para confirmação e só envia ao confirmar', async () => {
    await type('@enfermagem, paciente com SNE exteriorizada');
    await click('Revisar destinatários');

    expect(entryLabels()).toEqual(['@enfermagem']);
    expect(text()).toContain('Almira Borges');
    expect(source.sent.length).toBe(0);

    await click('Confirmar e enviar');

    expect(source.sent[0].recipients).toEqual([{ id: 5, name: 'Almira Borges', specialty: 'Enfermeira' }]);
  });

  it('grupo sem profissional vinculado: avisa, bloqueia o envio e permite registrar como observação', async () => {
    await type('@fisio avaliar mobilização');
    await click('Revisar destinatários');

    expect(text()).toContain('Nenhum profissional de @fisio está vinculado a este paciente.');
    expect(button('Confirmar e enviar')?.disabled).toBeTrue();
    expect(ai.suggestCalls).toBe(0);

    await click('Registrar como observação');

    expect(button('Registrar observação')?.disabled).toBeFalse();
    await click('Registrar observação');

    expect(source.sent[0].recipients).toEqual([]);
  });

  it('remover o destinatário inválido libera o registro como observação', async () => {
    await type('@fisio avaliar');
    await click('Revisar destinatários');
    (
      el().querySelector('[aria-label="Remover @fisio"] button, button[aria-label="Remover @fisio"]') as HTMLElement
    ).click();
    await settle();

    expect(el().querySelectorAll('.msg__entry').length).toBe(0);
    expect(button('Registrar observação')?.disabled).toBeFalse();
  });

  it('sem menção a IA sugere destinatários, marcados e removíveis; nada é enviado sozinho', async () => {
    ai.groups = Promise.resolve<readonly ProfessionalGroup[]>(['nurses']);
    await type('paciente com SNE exteriorizada');
    await click('Revisar destinatários');

    expect(entryLabels()).toEqual(['@enfermagem Sugerido pela IA']);
    expect(text()).toContain('Sugerido pela IA. Confirme, altere ou remova');
    expect(source.sent.length).toBe(0);

    await click('Recusar destinatários');

    expect(text()).toContain('sem notificar ninguém');
    await click('Registrar observação');

    expect(source.sent[0].recipients).toEqual([]);
  });

  it('sugestão de grupo sem vinculados também bloqueia o envio direcionado', async () => {
    ai.groups = Promise.resolve<readonly ProfessionalGroup[]>(['physio']);
    await type('paciente sem mobilização');
    await click('Revisar destinatários');

    expect(button('Confirmar e enviar')?.disabled).toBeTrue();
  });

  it('IA indisponível: avisa e segue com menção manual e com observação', async () => {
    ai.groups = Promise.reject(new Error('fora'));
    await type('paciente com SNE exteriorizada');
    await click('Revisar destinatários');

    expect(text()).toContain(AI_UNAVAILABLE_HINT);
    await click('Voltar e editar');
    await type('@almira SNE exteriorizada');
    await click('Revisar destinatários');
    await click('Confirmar e enviar');

    expect(source.sent[0].recipients.map(r => r.id)).toEqual([5]);
  });

  it('o profissional adiciona @todos, grupo e pessoa; repetição não duplica', async () => {
    await type('observação');
    await click('Revisar destinatários');
    const select = el().querySelector('#msg-add') as HTMLSelectElement;
    const pick = async (value: string): Promise<void> => {
      select.value = value;
      select.dispatchEvent(new Event('change'));
      await settle();
    };

    await pick('all');
    await pick('all');
    await pick('group:nurses');
    await pick('person:2');
    await pick('group:inexistente');
    await pick('person:999');

    expect(entryLabels()).toEqual(['@todos', '@enfermagem', 'Filippa Martins']);
    await click('Confirmar e enviar');

    expect(source.sent[0].recipients.map(r => r.id)).toEqual([1, 5, 2]);
  });

  it('áudio transcrito preenche o conteúdo para revisão e marca a origem', async () => {
    ai.text = Promise.resolve('  @nutris reavaliar dieta ');
    chat().triggerEventHandler('audioSend', new Blob(['a']));
    await settle();

    expect(text()).toContain(TRANSCRIBED_NOTE);
    expect((el().querySelector('#msg-content') as HTMLTextAreaElement).value).toBe('@nutris reavaliar dieta');
    await click('Revisar destinatários');
    await click('Confirmar e enviar');

    expect(source.sent[0].viaAudio).toBeTrue();
    expect(source.sent[0].recipients.map(r => r.id)).toEqual([2]);
  });

  it('áudio: texto acumula; falha, vazio e microfone liberam a digitação manual', async () => {
    ai.text = Promise.resolve('um');
    chat().triggerEventHandler('audioSend', new Blob(['a']));
    await settle();
    ai.text = Promise.resolve('dois');
    chat().triggerEventHandler('audioSend', new Blob(['a']));
    await settle();

    expect((el().querySelector('#msg-content') as HTMLTextAreaElement).value).toBe('um\ndois');

    ai.text = Promise.resolve('');
    chat().triggerEventHandler('audioSend', new Blob(['a']));
    await settle();

    expect(text()).toContain(AI_EMPTY_AUDIO_HINT);

    ai.text = Promise.reject(new Error('x'));
    chat().triggerEventHandler('audioSend', new Blob(['a']));
    await settle();

    expect(text()).toContain(AI_FAILED_AUDIO_HINT);

    chat().triggerEventHandler('audioModeError', 'permission-denied');
    await settle();

    expect(text()).toContain(MIC_DENIED_HINT);

    chat().triggerEventHandler('audioModeError', 'recorder-failed');
    await settle();

    expect(text()).toContain(MIC_FAILED_HINT);
  });

  it('texto do campo do assistente é acrescentado ao conteúdo; digitar remove a nota de transcrição', async () => {
    chat().triggerEventHandler('send', 'primeira');
    chat().triggerEventHandler('send', 'segunda');
    await settle();

    expect((el().querySelector('#msg-content') as HTMLTextAreaElement).value).toBe('primeira\nsegunda');
  });

  it('offline: criação indisponível com aviso e sem gravar; áudio ignorado', async () => {
    await type('observação');
    await click('Revisar destinatários');
    online.set(false);
    await settle();

    expect(text()).toContain('Sem conexão');
    expect(button('Registrar observação')?.disabled).toBeTrue();
    await (fixture.componentInstance as unknown as { confirm: () => Promise<void> }).confirm();
    await (fixture.componentInstance as unknown as { onAudio: (b: Blob) => Promise<void> }).onAudio(new Blob(['a']));

    expect(source.sent.length).toBe(0);
  });

  it('offline sem menção: não pede sugestão à IA', async () => {
    online.set(false);
    await type('observação');
    await click('Revisar destinatários');

    expect(ai.suggestCalls).toBe(0);
  });

  it('falha ao gravar mantém o conteúdo e avisa', async () => {
    source.fail = true;
    await type('observação');
    await click('Revisar destinatários');
    await click('Registrar observação');

    expect(text()).toContain('Não foi possível registrar');
    expect(closedCount).toBe(0);
    expect(el().querySelector('[data-testid="review-content"]')?.textContent).toContain('observação');
  });

  it('falha ao carregar a equipe avisa, mas a observação segue possível', async () => {
    team.fail = true;
    fixture.componentRef.setInput('open', false);
    await settle();
    fixture.componentRef.setInput('open', true);
    await settle();

    expect(text()).toContain(TEAM_FAILED_HINT);
    await type('observação');
    await click('Revisar destinatários');
    await click('Registrar observação');

    expect(source.sent.length).toBe(1);
  });

  it('fecha por botão, Esc e clique no scrim', async () => {
    (el().querySelector('app-icon-button button') as HTMLElement).click();
    const dialog = el().querySelector('dialog') as HTMLDialogElement;

    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(closedCount).toBe(3);
  });
});
