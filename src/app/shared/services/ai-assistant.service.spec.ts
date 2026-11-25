import { TestBed } from '@angular/core/testing';

import { AiAssistantService, COMMAND_TIMEOUT_MS } from './ai-assistant.service';
import { ASSISTANT_QUERY_RESOLVERS, type AssistantQueryResolver } from './assistant-query-resolver';
import { ConnectivityService } from './connectivity.service';
import { type ScreenAction, ScreenActionsService } from './screen-actions.service';

describe('AiAssistantService', () => {
  let service: AiAssistantService;
  const withForm: ScreenAction = {
    form: { fields: [], submit: (): void => undefined, submitLabel: 'Criar', title: 'Criar algo' },
    id: 'create',
    label: 'Criar algo',
  };
  const withoutForm: ScreenAction = { id: 'edit', label: 'Editar algo' };

  beforeEach(() => {
    service = TestBed.inject(AiAssistantService);
  });

  it('starts closed, on the chat view', () => {
    expect(service.isOpen()).toBeFalse();
    expect(service.view()).toBe('chat');
  });

  it('openPanel opens the chat; openShortcuts opens the screen actions', () => {
    service.openPanel();

    expect([service.isOpen(), service.view()]).toEqual([true, 'chat']);

    service.openShortcuts();

    expect([service.isOpen(), service.view()]).toEqual([true, 'shortcuts']);
  });

  it('shortcutsOpen só vale na sidebar de Atalhos: o cadastro conversacional não desabilita o botão', () => {
    expect(service.shortcutsOpen()).toBeFalse();
    service.openShortcuts();

    expect(service.shortcutsOpen()).toBeTrue();
    service.openAction(withForm);

    expect(service.shortcutsOpen()).toBeFalse();
  });

  it('openAction shows the form for a registration and the notice for an action without one', () => {
    service.openAction(withForm);

    expect([service.view(), service.activeAction()]).toEqual(['form', withForm]);

    service.openAction(withoutForm);

    expect([service.view(), service.activeAction()]).toEqual(['unavailable', withoutForm]);
  });

  it('openAction de navegação fecha o painel e navega, sem formulário', () => {
    const navigate = jasmine.createSpy('navigate');

    service.openShortcuts();
    service.openAction({ id: 'go', label: 'Ir', navigate });

    expect([service.isOpen(), service.view(), service.activeAction()]).toEqual([false, 'chat', null]);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('back returns to the shortcuts and clears the active action', () => {
    service.openAction(withForm);
    service.back();

    expect([service.view(), service.activeAction(), service.isOpen()]).toEqual(['shortcuts', null, true]);
  });

  it('closePanel closes and resets to the chat view', () => {
    service.openAction(withForm);
    service.closePanel();

    expect([service.isOpen(), service.view(), service.activeAction()]).toEqual([false, 'chat', null]);
  });

  describe('ask routing', () => {
    let screenActions: ScreenActionsService;
    const patient: ScreenAction = { ...withForm, id: 'register-patient', label: 'Cadastrar paciente' };
    const bed: ScreenAction = { ...withForm, id: 'move-bed', label: 'Movimentar leito' };

    beforeEach(() => {
      screenActions = TestBed.inject(ScreenActionsService);
    });

    it('opens the registered patient registration for a recognized request, ignoring case and accents', () => {
      screenActions.register([patient, bed]);
      service.ask('  CADASTRAR   novo paciente ');

      expect([service.view(), service.activeAction(), service.isOpen()]).toEqual(['form', patient, true]);
    });

    it('opens the registered bed move for a recognized request', () => {
      screenActions.register([patient, bed]);
      service.ask('Quero movimentar um leito');

      expect(service.activeAction()).toBe(bed);
    });

    it('shows the unavailable notice when the action is not registered', () => {
      service.ask('cadastrar novo paciente');

      expect([service.view(), service.activeAction()?.id]).toEqual(['unavailable', 'register-patient']);
    });

    it('shows the unavailable notice for a bed move when not registered', () => {
      service.ask('mover paciente de leito');

      expect([service.view(), service.activeAction()?.id]).toEqual(['unavailable', 'move-bed']);
    });

    it('does not open any action for unrecognized or ambiguous messages', () => {
      screenActions.register([patient, bed]);
      service.ask('qual a previsão do tempo?');
      service.ask('cadastrar paciente e mover leito');

      expect([service.view(), service.activeAction(), service.lastQuestion()]).toEqual([
        'chat',
        null,
        'cadastrar paciente e mover leito',
      ]);
    });

    it('opens the same definition as the shortcut and discards it on close', () => {
      screenActions.register([patient]);
      service.ask('cadastrar novo paciente');
      const viaMessage = service.activeAction();

      service.openAction(patient);

      expect(viaMessage).toBe(service.activeAction());

      service.closePanel();

      expect([service.view(), service.activeAction()]).toEqual(['chat', null]);
    });
  });

  describe('ask', () => {
    const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve));
    let resolve: (answer: { summary: string }) => void;
    let reject: () => void;
    let resolver: AssistantQueryResolver;

    beforeEach(() => {
      resolver = {
        matches: (q: string): boolean => q === 'known',
        resolve: (): Promise<{ summary: string }> =>
          new Promise((res, rej) => {
            resolve = res;
            reject = (): void => rej(new Error('x'));
          }),
      };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: ASSISTANT_QUERY_RESOLVERS, useValue: [resolver] }],
      });
      service = TestBed.inject(AiAssistantService);
    });

    it('starts without a conversation', () => {
      expect(service.conversation()).toBeNull();
    });

    it('is loading while the resolver works, then shows the answer', async () => {
      service.ask('known');

      expect(service.conversation()).toEqual({ answer: null, question: 'known', status: 'loading' });

      resolve({ summary: 'ok' });
      await flush();

      expect(service.conversation()).toEqual({ answer: { summary: 'ok' }, question: 'known', status: 'answered' });
    });

    it('shows a generic error when the resolver fails', async () => {
      service.ask('known');
      reject();
      await flush();

      expect([service.conversation()?.status, service.conversation()?.answer?.summary]).toEqual([
        'failed',
        'Não foi possível obter a resposta agora. Tente novamente em instantes.',
      ]);
    });

    it('answers an unrecognized question with the default "not yet" answer', () => {
      service.ask('outra coisa');

      expect(service.conversation()).toEqual({
        answer: { summary: 'Ainda não sei responder a essa pergunta.' },
        question: 'outra coisa',
        status: 'answered',
      });
    });

    it('ignores a stale answer when a newer question was asked', async () => {
      service.ask('known');
      const staleResolve = resolve;

      service.ask('outra coisa');
      staleResolve({ summary: 'velha' });
      await flush();

      expect(service.conversation()?.question).toBe('outra coisa');
    });

    it('closePanel clears the conversation and drops pending answers', async () => {
      service.openPanel();
      service.ask('known');
      service.closePanel();
      resolve({ summary: 'tarde' });
      await flush();

      expect([service.conversation(), service.lastQuestion()]).toEqual([null, null]);
    });
  });

  describe('comando encaminhado pela tela', () => {
    const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve));

    it('sem handler, áudio é ignorado e a pergunta segue os resolvedores', () => {
      service.askAudio(new Blob(['x']));
      service.ask('qualquer coisa');

      expect(service.conversation()?.question).toBe('qualquer coisa');
    });

    it('com handler: não usa resolvedores nem "não reconhecido"; mostra enviado', async () => {
      const handler = jasmine.createSpy('handler').and.resolveTo();

      TestBed.inject(ScreenActionsService).registerCommandHandler(handler);
      service.ask('apenas NP');

      expect(service.conversation()?.status).toBe('loading');
      await flush();

      expect(handler).toHaveBeenCalledWith({ kind: 'text', text: 'apenas NP' });
      expect(service.conversation()).toEqual({
        answer: { summary: 'Comando enviado à IA.' },
        question: 'apenas NP',
        status: 'answered',
      });
    });

    it('pedido de ação conhecido ("cadastrar paciente") segue o fluxo de ações, não o comando de IA', () => {
      const handler = jasmine.createSpy('handler').and.resolveTo();

      TestBed.inject(ScreenActionsService).registerCommandHandler(handler);
      service.ask('cadastrar paciente');

      expect(handler).not.toHaveBeenCalled();
    });

    it('áudio enviado como gravado, com rótulo de texto', async () => {
      const handler = jasmine.createSpy('handler').and.resolveTo();
      const audio = new Blob(['x']);

      TestBed.inject(ScreenActionsService).registerCommandHandler(handler);
      service.askAudio(audio);
      await flush();

      expect(handler).toHaveBeenCalledWith({ audio, kind: 'audio' });
      expect(service.conversation()?.question).toBe('Comando de áudio');
    });

    it('offline: não envia e pede conexão; ao voltar, o retry envia', async () => {
      const handler = jasmine.createSpy('handler').and.resolveTo();
      const online = TestBed.inject(ConnectivityService).online;

      TestBed.inject(ScreenActionsService).registerCommandHandler(handler);
      online.set(false);
      service.ask('apenas NP');

      expect(handler).not.toHaveBeenCalled();
      expect(service.conversation()?.answer?.summary).toBe('Conexão necessária para enviar comandos à IA.');
      online.set(true);
      service.retry('apenas NP');
      await flush();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(service.conversation()?.status).toBe('answered');
    });

    it('falha (rejeição ou exceção síncrona) vira aviso e retry reenvia o mesmo comando', async () => {
      const handler = jasmine.createSpy('handler').and.throwError('boom');

      TestBed.inject(ScreenActionsService).registerCommandHandler(handler);
      service.ask('x');
      await flush();

      expect(service.conversation()?.status).toBe('failed');
      expect(service.conversation()?.answer?.summary).toBe('IA indisponível no momento.');
      handler.and.rejectWith(new Error('r'));
      service.retry('x');
      await flush();

      expect(service.conversation()?.status).toBe('failed');
      handler.and.resolveTo();
      service.retry('x');
      await flush();

      expect(service.conversation()?.status).toBe('answered');
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('tempo esgotado conta como indisponível', async () => {
      jasmine.clock().install();
      try {
        TestBed.inject(ScreenActionsService).registerCommandHandler(() => new Promise<void>(() => undefined));
        service.ask('x');
        await Promise.resolve();
        jasmine.clock().tick(COMMAND_TIMEOUT_MS);
      } finally {
        jasmine.clock().uninstall();
      }
      await flush();

      expect(service.conversation()?.status).toBe('failed');
    });

    it('handler removido antes do retry: indisponível; retry de outra pergunta usa o fluxo comum', async () => {
      const cleanup = TestBed.inject(ScreenActionsService).registerCommandHandler(() => Promise.resolve());

      service.ask('x');
      await flush();
      cleanup();
      service.retry('x');

      expect(service.conversation()?.status).toBe('failed');
      service.retry('outra');

      expect(service.conversation()?.question).toBe('outra');
    });
  });
});
