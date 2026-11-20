import { TestBed } from '@angular/core/testing';

import { AiAssistantService } from './ai-assistant.service';
import { ASSISTANT_QUERY_RESOLVERS, type AssistantQueryResolver } from './assistant-query-resolver';
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
});
