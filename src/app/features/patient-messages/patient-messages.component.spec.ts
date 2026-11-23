import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InputChatComponent } from '../../shared/components/input-chat/input-chat.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import { PatientThreadsComponent } from './patient-messages.component';
import { MessageThread, ThreadReplyRequest, ThreadResolveRequest } from './patient-messages.models';
import { PatientMessagesSource, PatientMessagesWriter, ReplyTranscriber } from './patient-messages-source';
import { ProvisionalPatientMessages } from './provisional-patient-messages';

describe('PatientThreadsComponent', () => {
  const NOW_DATE = new Date('2026-11-22T12:00:00.000Z');
  let fixture: ComponentFixture<PatientThreadsComponent>;
  let online: WritableSignal<boolean>;
  let failList: boolean;
  let failReply: boolean;
  let failResolve: boolean;
  let profileName: string;
  let transcript: string | Error;
  let requests: ThreadReplyRequest[];

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const threads = (): HTMLElement[] => Array.from(el().querySelectorAll('[data-testid="thread"]'));
  const textarea = (i = 0): HTMLTextAreaElement => threads()[i].querySelector('textarea') as HTMLTextAreaElement;
  const sendButton = (i = 0): HTMLButtonElement =>
    Array.from(threads()[i].querySelectorAll('button')).find(
      b => b.textContent.trim() === 'Enviar resposta',
    ) as HTMLButtonElement;
  const type = async (text: string, i = 0): Promise<void> => {
    const area = textarea(i);

    area.value = text;
    area.dispatchEvent(new Event('input'));
    await settle();
  };
  const create = async (patientId = 'p1'): Promise<void> => {
    fixture = TestBed.createComponent(PatientThreadsComponent);
    fixture.componentRef.setInput('patientId', patientId);
    await settle();
  };
  const chat = (i = 0): InputChatComponent =>
    fixture.debugElement.queryAll(d => d.componentInstance instanceof InputChatComponent)[i]
      .componentInstance as InputChatComponent;

  beforeEach(() => {
    online = signal(true);
    failList = false;
    failReply = false;
    failResolve = false;
    profileName = 'Michelle';
    transcript = 'texto transcrito';
    requests = [];
    TestBed.configureTestingModule({
      providers: [
        ProvisionalPatientMessages,
        {
          provide: PatientMessagesSource,
          useFactory: (): PatientMessagesSource => {
            const real = TestBed.inject(ProvisionalPatientMessages);

            return {
              list: (id: string): Promise<readonly MessageThread[]> =>
                failList ? Promise.reject(new Error('falhou')) : real.list(id),
              listBySender: (a: string): Promise<readonly MessageThread[]> => real.listBySender(a),
            };
          },
        },
        {
          provide: PatientMessagesWriter,
          useFactory: (): PatientMessagesWriter => {
            const real = TestBed.inject(ProvisionalPatientMessages);

            return {
              reply: (r: ThreadReplyRequest): Promise<MessageThread> => {
                requests.push(r);

                return failReply ? Promise.reject(new Error('falhou')) : real.reply(r);
              },
              resolve: (r: ThreadResolveRequest): Promise<MessageThread> =>
                failResolve ? Promise.reject(new Error('falhou')) : real.resolve(r),
            };
          },
        },
        {
          provide: ReplyTranscriber,
          useValue: {
            transcribe: (): Promise<string> =>
              transcript instanceof Error ? Promise.reject(transcript) : Promise.resolve(transcript as string),
          },
        },
        { provide: ConnectivityService, useValue: { online } },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): object => ({ name: profileName, role: 'other' }) },
        },
        { provide: NOW, useValue: (): Date => NOW_DATE },
      ],
    });
  });

  it('mostra todas as threads do paciente, inclusive as que não mencionam o profissional', async () => {
    await create();

    expect(threads().length).toBe(2);
    expect(el().textContent).toContain('Dra. Helena Prado · ');
    expect(el().textContent).toContain('Para: @nutris');
    expect(el().textContent).toContain('resíduo gástrico elevado');
  });

  it('cada card mostra estado em texto e "Vencida" quando o prazo passou', async () => {
    await create();

    expect(el().querySelectorAll('[data-testid="thread-status"]')[0].textContent).toContain('Ativa');
    expect(el().querySelectorAll('[data-testid="thread-overdue"]').length).toBe(1);
  });

  it('paciente sem threads mostra estado vazio', async () => {
    await create('outro');

    expect(el().querySelector('[data-testid="threads-empty"]')).not.toBeNull();
  });

  it('falha de carga mostra erro e permite tentar de novo', async () => {
    failList = true;
    await create();

    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Não foi possível carregar');
    failList = false;
    (
      Array.from(el().querySelectorAll('button')).find(b => b.textContent.includes('Tentar novamente')) as HTMLElement
    ).click();
    await settle();

    expect(threads().length).toBe(2);
  });

  it('falha ao recarregar mantém as threads já carregadas', async () => {
    await create();
    failList = true;
    await (fixture.componentInstance as unknown as { load(): Promise<void> }).load();
    await settle();

    expect(threads().length).toBe(2);
  });

  it('envia resposta de texto, registrada na thread, sem o profissional ter sido mencionado', async () => {
    await create();
    await type('  Vou reduzir a velocidade.  ');
    sendButton().click();
    await settle();

    expect(requests[0]).toEqual(
      jasmine.objectContaining({ author: 'Michelle', origin: 'text', text: 'Vou reduzir a velocidade.' }),
    );

    expect(el().querySelectorAll('[data-testid="reply"]').length).toBe(1);
    expect(el().textContent).toContain('Michelle · ');
    expect(textarea().value).toBe('');
  });

  it('resposta vazia não pode ser enviada', async () => {
    await create();
    await type('   ');

    expect(sendButton().disabled).toBe(true);
    sendButton().click();
    await settle();

    expect(requests.length).toBe(0);
  });

  it('falha de envio mostra erro e preserva o texto digitado', async () => {
    failReply = true;
    await create();
    await type('Oi');
    sendButton().click();
    await settle();

    expect(el().textContent).toContain('Não foi possível enviar a resposta');
    expect(textarea().value).toBe('Oi');
    expect(el().querySelectorAll('[data-testid="reply"]').length).toBe(0);
  });

  it('responder a thread resolvida a reabre e registra a reabertura com autor e data/hora', async () => {
    const store = TestBed.inject(ProvisionalPatientMessages);

    (store as unknown as { threads: MessageThread[] }).threads = [{ ...(await store.list('p1'))[0], resolved: true }];
    await create();

    expect(el().querySelector('[data-testid="thread-status"]')?.textContent).toContain('Resolvida');
    await type('Retomando');
    sendButton().click();
    await settle();

    expect(el().querySelector('[data-testid="thread-status"]')?.textContent).toContain('Ativa');
    expect(el().querySelector('[data-testid="status-change"]')?.textContent).toContain('Reaberta por Michelle');
  });

  it('offline: envio desabilitado com explicação em texto', async () => {
    await create();
    await type('Oi');
    online.set(false);
    await settle();

    expect(sendButton().disabled).toBe(true);
    expect(el().textContent).toContain('Sem conexão: responder fica indisponível');
  });

  it('áudio: o texto transcrito vai para o campo editável e é enviado como origem "audio"', async () => {
    await create();
    chat().audioSend.emit(new Blob(['x']));
    await settle();

    expect(textarea().value).toBe('texto transcrito');
    sendButton().click();
    await settle();

    expect(requests[0].origin).toBe('audio');
    expect(el().textContent).toContain('áudio transcrito');
  });

  it('áudio: editar o texto transcrito passa a origem para texto digitado', async () => {
    await create();
    chat().audioSend.emit(new Blob(['x']));
    await settle();
    await type('texto transcrito editado');

    sendButton().click();
    await settle();

    expect(requests[0].origin).toBe('text');
  });

  it('áudio: falha na transcrição avisa e permite digitar manualmente', async () => {
    transcript = new Error('falhou');
    await create();
    chat().audioSend.emit(new Blob(['x']));
    await settle();

    expect(el().textContent).toContain('Não foi possível transcrever o áudio');
    await type('manual');

    expect(sendButton().disabled).toBe(false);
  });

  it('áudio: transcrição vazia avisa', async () => {
    transcript = '';
    await create();
    chat().audioSend.emit(new Blob(['x']));
    await settle();

    expect(el().textContent).toContain('Nenhum texto foi identificado');
  });

  it('áudio: erros de microfone avisam', async () => {
    await create();
    chat().audioModeError.emit('permission-denied');
    await settle();

    expect(el().textContent).toContain('Sem acesso ao microfone');
    chat().audioModeError.emit('unavailable');
    await settle();

    expect(el().textContent).toContain('Não foi possível gravar o áudio');
  });

  it('áudio recebido offline é ignorado', async () => {
    await create();
    const c = chat();

    online.set(false);
    await (fixture.componentInstance as unknown as { onAudio(t: MessageThread, a: Blob): Promise<void> }).onAudio(
      (fixture.componentInstance as unknown as { threads(): MessageThread[] }).threads()[0],
      new Blob(['x']),
    );

    expect(c).toBeDefined();
    expect(textarea().value).toBe('');
  });

  describe('resolver thread', () => {
    const resolveButton = (i = 0): HTMLButtonElement | null =>
      threads()[i].querySelector('[data-testid="resolve-thread"] button');
    const answer = async (label: string): Promise<void> => {
      const buttons = Array.from(el().querySelectorAll('app-confirm-dialog button'));

      (buttons.find(b => b.textContent.trim() === label) as HTMLButtonElement).click();
      await settle();
    };
    // thread-2 (mais antiga) é de "Michelle Franklin" e aparece em segundo.
    const mine = 1;

    beforeEach(() => {
      profileName = 'Michelle Franklin';
    });

    it('só participante vê o indicador de resolução', async () => {
      await create();

      expect(resolveButton(mine)).not.toBeNull();
      expect(resolveButton(0)).toBeNull();
    });

    it('quem foi mencionado pelo nome ou já respondeu também participa', async () => {
      profileName = 'Dra. Helena Prado';
      await create();

      expect(resolveButton(0)).not.toBeNull();
      profileName = 'Ana';
      await create();
      expect(resolveButton(0)).toBeNull();
    });

    it('confirmar marca como resolvida, registra a mudança e some o indicador, sem abrir conversa', async () => {
      await create();
      resolveButton(mine)?.click();
      await settle();
      await answer('Sim');

      expect(threads()[mine].querySelector('[data-testid="thread-status"]')?.textContent).toContain('Resolvida');
      expect(threads()[mine].querySelector('[data-testid="status-change"]')?.textContent).toContain(
        'Resolvida por Michelle Franklin',
      );
      expect(resolveButton(mine)).toBeNull();
    });

    it('cancelar não resolve', async () => {
      await create();
      resolveButton(mine)?.click();
      await settle();
      await answer('Não');

      expect(threads()[mine].querySelector('[data-testid="thread-status"]')?.textContent).toContain('Ativa');
    });

    it('falha mantém a thread ativa e informa em texto', async () => {
      failResolve = true;
      await create();
      resolveButton(mine)?.click();
      await settle();
      await answer('Sim');

      expect(threads()[mine].querySelector('[data-testid="thread-status"]')?.textContent).toContain('Ativa');
      expect(threads()[mine].querySelector('[data-testid="resolve-error"]')?.textContent).toContain('continua ativa');
    });

    it('offline: indicador desabilitado com aviso, e nada é despachado', async () => {
      await create();
      online.set(false);
      await settle();

      expect(resolveButton(mine)?.disabled).toBeTrue();
      expect(threads()[mine].textContent).toContain('marcar como resolvida fica indisponível');
      const component = fixture.componentInstance as unknown as {
        onResolveClick(t: MessageThread): void;
        resolveConfirmId(): string | null;
        onConfirmResolve(): Promise<void>;
      };
      const thread = (await TestBed.inject(PatientMessagesSource).list('p1')).find(t => t.id === 'thread-2');

      component.onResolveClick(thread as MessageThread);
      expect(component.resolveConfirmId()).toBeNull();
      await component.onConfirmResolve();
      expect(threads()[mine].querySelector('[data-testid="thread-status"]')?.textContent).toContain('Ativa');
    });

    it('se ficar offline com o diálogo aberto, confirmar não grava', async () => {
      await create();
      resolveButton(mine)?.click();
      await settle();
      online.set(false);
      await answer('Sim');

      expect(threads()[mine].querySelector('[data-testid="thread-status"]')?.textContent).toContain('Ativa');
    });
  });
});
