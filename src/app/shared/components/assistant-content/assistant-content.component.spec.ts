import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { AiAssistantService } from '../../services/ai-assistant.service';
import { AssistantConversationService } from '../../services/assistant-conversation.service';
import { ASSISTANT_QUERY_RESOLVERS } from '../../services/assistant-query-resolver';
import { type ScreenAction, ScreenActionsService } from '../../services/screen-actions.service';
import { UserDirectory } from '../../services/user-directory';
import { AssistantFormComponent } from '../assistant-form/assistant-form.component';
import { AssistantContentComponent } from './assistant-content.component';

describe('AssistantContentComponent', () => {
  let fixture: ComponentFixture<AssistantContentComponent>;
  let assistant: AiAssistantService;
  const create: ScreenAction = {
    form: {
      fields: [{ id: 'm', kind: 'text', label: 'Mensagem?', placeholder: 'Escreva', required: true }],
      submit: (): void => undefined,
      submitLabel: 'Criar notificação',
      title: 'Criar notificação',
    },
    id: 'create',
    label: 'Criar notificação',
  };
  const edit: ScreenAction = { id: 'edit', label: 'Editar notificação' };

  const el = (): HTMLElement => fixture.nativeElement;
  const text = (selector: string): string => el().querySelector(selector)?.textContent?.trim() ?? '';
  /** Deixa o título e a descrição do cadastro terminarem de ser digitados (os componentes surgem depois). */
  const finishTyping = (): void => {
    for (let i = 0; i < 4; i++) {
      jasmine.clock().tick(3000);
      fixture.detectChanges();
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssistantContentComponent],
      providers: [{ provide: UserDirectory, useValue: { search: (): Promise<[]> => Promise.resolve([]) } }],
    }).compileComponents();
    assistant = TestBed.inject(AiAssistantService);
    TestBed.inject(ScreenActionsService).register([create, edit]);
    fixture = TestBed.createComponent(AssistantContentComponent);
    fixture.detectChanges();
  });

  it('chat: greets the user', () => {
    expect(text('.assistant-content__title')).toBe('Como eu posso te ajudar?');
    // A dica de texto/áudio saiu do conteúdo: fica acima do campo de mensagem (drawer/bottom sheet).
    expect(el().querySelector('.assistant-content__hint')).toBeNull();
  });

  it('chat: shows the welcome message while there is no conversation (Figma v2/AssistantPanel)', () => {
    expect(el().querySelector('.assistant-content__title')?.textContent).toContain('Como eu posso te ajudar?');
  });

  it('chat: hides the welcome message once a question was asked (Figma, seção 09 · A2)', () => {
    assistant.ask('Quais são minhas pendências de hoje?');
    fixture.detectChanges();

    expect(el().querySelector('.assistant-content__title')).toBeNull();
  });

  it('free text that is not a suggestion goes through the same entry point unchanged', () => {
    assistant.ask('Qual o leito do paciente João?');

    expect(assistant.lastQuestion()).toBe('Qual o leito do paciente João?');
  });

  it('shows the question followed by the assistant answer area', () => {
    assistant.ask('Qual o leito do paciente João?');
    fixture.detectChanges();

    expect(text('.assistant-content__question')).toBe('Qual o leito do paciente João?');
    expect(text('.assistant-content__answer')).toContain('Ainda não sei responder');
  });

  it('shows a loading indicator and then the answer items', async () => {
    let finish!: (answer: { items: string[]; summary: string }) => void;

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AssistantContentComponent],
      providers: [
        {
          provide: ASSISTANT_QUERY_RESOLVERS,
          useValue: [
            {
              matches: (): boolean => true,
              resolve: (): Promise<{ items: string[]; summary: string }> =>
                new Promise(resolve => {
                  finish = resolve;
                }),
            },
          ],
        },
      ],
    }).compileComponents();
    assistant = TestBed.inject(AiAssistantService);
    fixture = TestBed.createComponent(AssistantContentComponent);
    assistant.ask('qualquer');
    fixture.detectChanges();

    expect(text('[role="status"]')).toContain('Buscando');

    finish({ items: ['a', 'b'], summary: 'Resumo' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text('.assistant-content__answer')).toContain('Resumo');
    expect(el().querySelectorAll('.assistant-content__answer-items li').length).toBe(2);
  });

  it('shows the error message with alert role when the answer fails', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AssistantContentComponent],
      providers: [
        {
          provide: ASSISTANT_QUERY_RESOLVERS,
          useValue: [{ matches: (): boolean => true, resolve: (): Promise<never> => Promise.reject(new Error('x')) }],
        },
      ],
    }).compileComponents();
    assistant = TestBed.inject(AiAssistantService);
    fixture = TestBed.createComponent(AssistantContentComponent);
    assistant.ask('qualquer');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text('[role="alert"]')).toContain('Não foi possível obter a resposta');
  });

  it('reopening the panel shows a clean conversation', () => {
    assistant.ask('Qual o leito do paciente João?');
    assistant.closePanel();
    assistant.openPanel();
    fixture.detectChanges();

    expect(el().querySelector('.assistant-content__question')).toBeNull();
  });

  it('chips are not shown in shortcuts, form and unavailable views', () => {
    for (const open of [
      (): void => assistant.openShortcuts(),
      (): void => assistant.openAction(create),
      (): void => assistant.openAction(edit),
    ]) {
      open();
      fixture.detectChanges();

      expect(el().querySelector('.assistant-content__chip')).toBeNull();
    }
  });

  it('shortcuts: lists the screen actions right under the question', () => {
    assistant.openShortcuts();
    fixture.detectChanges();

    // O título "Atalhos" fica no cabeçalho do painel (no lugar do logo), não no conteúdo.
    expect(el().querySelector('.assistant-content__title')).toBeNull();
    expect(text('.assistant-content__body')).toContain('Qual ação você deseja executar nessa tela');
    expect(
      Array.from(el().querySelectorAll('.assistant-content__actions button')).map(b => b.textContent?.trim()),
    ).toEqual(['Criar notificação', 'Editar notificação']);
  });

  it('shortcuts: mostra o envio do comando de IA em texto e, na falha, o aviso com "Tentar novamente"', async () => {
    const handler = jasmine.createSpy('handler').and.resolveTo();
    const flush = async (): Promise<void> => {
      await new Promise(resolve => setTimeout(resolve));
      fixture.detectChanges();
    };

    TestBed.inject(ScreenActionsService).registerCommandHandler(handler);
    assistant.openShortcuts();
    assistant.ask('apenas NP');
    await flush();

    expect(text('.assistant-content__conversation')).toContain('Comando enviado à IA.');
    handler.and.rejectWith(new Error('x'));
    assistant.ask('apenas NP');
    await flush();

    expect(text('.assistant-content__error')).toContain('IA indisponível no momento.');
    handler.and.resolveTo();
    (el().querySelector('.assistant-content__answer app-button button') as HTMLButtonElement).click();
    await flush();

    expect(text('.assistant-content__conversation')).toContain('Comando enviado à IA.');
  });

  it('shortcuts: says so when the screen has no actions', () => {
    TestBed.inject(ScreenActionsService).register([]);
    assistant.openShortcuts();
    fixture.detectChanges();

    expect(text('.assistant-content__actions')).toContain('Nenhuma ação disponível');
  });

  it('choosing a registration opens its form: título e descrição são digitados e só depois surgem os campos', () => {
    jasmine.clock().install();
    assistant.openShortcuts();
    fixture.detectChanges();
    (el().querySelectorAll('.assistant-content__actions button')[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(assistant.view()).toBe('form');
    expect(el().querySelector('app-assistant-form')).toBeNull();
    finishTyping();

    expect(el().querySelector('app-assistant-form')).toBeTruthy();
    jasmine.clock().uninstall();
  });

  it('editor: título e descrição digitados, a linha de apoio e só depois o componente do editor', () => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      selector: 'app-fake-editor',
      template: '<p class="fake-editor">{{ label() }}</p>',
    })
    class FakeEditorComponent {
      readonly label = input('');
    }
    jasmine.clock().install();
    assistant.openAction({
      editor: {
        component: FakeEditorComponent,
        description: 'Descrição do editor',
        hint: 'Apoio do editor',
        inputs: { label: 'Campos do editor' },
        title: 'Avaliação clínica',
      },
      id: 'clinical',
      label: 'Avaliação clínica',
    });
    fixture.detectChanges();

    expect(assistant.view()).toBe('editor');
    expect(el().querySelector('.fake-editor')).toBeNull();
    finishTyping();

    expect(el().querySelector('.fake-editor')?.textContent).toBe('Campos do editor');
    expect(text('.assistant-content__hint')).toBe('Apoio do editor');
    jasmine.clock().uninstall();
  });

  it('an action without a form says it is not available yet', () => {
    assistant.openAction(edit);
    fixture.detectChanges();

    expect(text('.assistant-content__body')).toContain('ainda não está disponível');
  });

  it('after the registration is saved the panel goes back to the shortcuts', () => {
    jasmine.clock().install();
    assistant.openAction(create);
    fixture.detectChanges();
    finishTyping();
    fixture.debugElement.query(By.directive(AssistantFormComponent)).componentInstance.submitted.emit();
    fixture.detectChanges();

    expect(assistant.view()).toBe('shortcuts');
    jasmine.clock().uninstall();
  });

  describe('helpers de resposta', () => {
    interface Internals {
      itemRoute(item: unknown): string | null;
      itemText(item: unknown): string;
      itemTitle(item: unknown): string | null;
      openRoute(route: string): void;
      retry(question: string): void;
    }
    const internals = (): Internals => fixture.componentInstance as unknown as Internals;

    it('lê texto, título e rota de itens em string ou objeto', () => {
      expect(internals().itemText('abc')).toBe('abc');
      expect(internals().itemText({ route: '/x', text: 'def' })).toBe('def');
      expect(internals().itemTitle('abc')).toBeNull();
      expect(internals().itemTitle({ route: '/x', text: 'def' })).toBeNull();
      expect(internals().itemTitle({ route: '/x', text: 'def', title: 'T' })).toBe('T');
      expect(internals().itemRoute('abc')).toBeNull();
      expect(internals().itemRoute({ route: '/x', text: 'def' })).toBe('/x');
    });

    it('openRoute fecha o painel e navega para o destino', () => {
      spyOn(assistant, 'closePanel');
      const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

      internals().openRoute('/notifications');

      expect(assistant.closePanel).toHaveBeenCalledWith();
      expect(navigate).toHaveBeenCalledWith('/notifications');
    });

    it('retry repete a pergunta no assistente', () => {
      spyOn(assistant, 'ask');

      internals().retry('Quais notificações?');

      expect(assistant.ask).toHaveBeenCalledWith('Quais notificações?');
    });
  });

  describe('chips de ordenação', () => {
    const active = signal<string | null>(null);
    const chips = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('.assistant-content__chip'));

    beforeEach(() => {
      active.set(null);
      TestBed.inject(ScreenActionsService).registerSort({
        active,
        options: [
          { id: 'priority', label: 'Por prioridade' },
          { id: 'bed', label: 'Por leito' },
        ],
        select: id => active.set(id),
      });
      assistant.openShortcuts();
      fixture.detectChanges();
    });

    it('mostra os chips sem seleção e o chip acionado fica pressionado com ✓', () => {
      expect(chips().map(c => c.textContent?.trim())).toEqual(['Por prioridade', 'Por leito']);
      expect(chips().every(c => c.getAttribute('aria-pressed') === 'false')).toBeTrue();

      chips()[1].click();
      fixture.detectChanges();

      expect(chips()[1].getAttribute('aria-pressed')).toBe('true');
      expect(chips()[1].querySelector('ph-icon')).not.toBeNull();
      expect(chips()[0].getAttribute('aria-pressed')).toBe('false');
    });

    it('sem ordenação registrada não há seção de ordenação', () => {
      TestBed.inject(ScreenActionsService).registerSort({ active, options: [], select: () => undefined })();
      fixture.detectChanges();

      expect(el().querySelector('.assistant-content__chips')).toBeNull();
    });
  });

  describe('saudação da tela: texto próprio, digitado, com o aviso em fade', () => {
    const live = (index: number): string => el().querySelectorAll('.typewriter__live')[index]?.textContent ?? '';

    beforeEach(() => jasmine.clock().install());

    afterEach(() => jasmine.clock().uninstall());

    it('usa o título e o texto registrados pela tela, escreve um depois do outro e mostra o aviso 2s depois', () => {
      TestBed.inject(ScreenActionsService).registerContext({
        description: 'Descrição da tela',
        title: 'Título da tela',
      });
      assistant.openPanel();
      fixture.detectChanges();

      expect(live(0)).toBe('');
      expect(live(1)).toBe('');

      jasmine.clock().tick(14 * 'Título da tela'.length);
      fixture.detectChanges();

      expect(live(0)).toBe('Título da tela');
      expect(live(1)).toBe('');

      jasmine.clock().tick(14 * 'Descrição da tela'.length);
      fixture.detectChanges();

      expect(live(1)).toBe('Descrição da tela');

      jasmine.clock().tick(1999);
      fixture.detectChanges();

      jasmine.clock().tick(1);
      fixture.detectChanges();
    });

    it('sem texto registrado pela tela usa a saudação padrão', () => {
      assistant.openPanel();
      fixture.detectChanges();
      jasmine.clock().tick(14 * 'Como eu posso te ajudar?'.length);
      fixture.detectChanges();

      expect(live(0)).toBe('Como eu posso te ajudar?');
    });

    it('trocar de tela com o painel aberto não reinicia a digitação nem muda o texto já escrito', () => {
      const screen = TestBed.inject(ScreenActionsService);

      screen.registerContext({ description: 'Descrição A', title: 'Título A' });
      assistant.openPanel();
      fixture.detectChanges();
      for (const ms of [1000, 3000, 2500]) {
        jasmine.clock().tick(ms);
        fixture.detectChanges();
      }

      expect(live(0)).toBe('Título A');
      expect(live(1)).toBe('Descrição A');

      screen.registerContext({ description: 'Descrição B', title: 'Título B' });
      fixture.detectChanges();
      jasmine.clock().tick(50);
      fixture.detectChanges();

      expect(live(0)).toBe('Título A');
      expect(live(1)).toBe('Descrição A');
    });

    it('uma nova abertura lê a tela de novo e escreve o texto da tela atual', () => {
      const screen = TestBed.inject(ScreenActionsService);

      screen.registerContext({ description: 'Descrição A', title: 'Título A' });
      assistant.openPanel();
      fixture.detectChanges();
      assistant.closePanel();
      fixture.detectChanges();
      screen.registerContext({ description: 'Descrição B', title: 'Título B' });
      assistant.openPanel();
      fixture.detectChanges();
      jasmine.clock().tick(14 * 'Título B'.length);
      fixture.detectChanges();

      expect(live(0)).toBe('Título B');
    });

    it('fechar e reabrir o painel escreve tudo de novo e esconde o aviso', () => {
      assistant.openPanel();
      fixture.detectChanges();
      // título → descrição → aviso: cada etapa só começa depois de um ciclo de detecção da anterior.
      for (const ms of [1000, 3000, 2500]) {
        jasmine.clock().tick(ms);
        fixture.detectChanges();
      }

      assistant.closePanel();
      fixture.detectChanges();
      assistant.openPanel();
      fixture.detectChanges();

      expect(live(0)).toBe('');
    });
  });

  describe('conversation (cadastro um dado por vez)', () => {
    const submit = jasmine.createSpy('submit');
    const chat: ScreenAction = {
      conversation: {
        errorMessage: 'Falhou',
        skipLabel: 'Pular',
        steps: [
          { id: 'name', parse: raw => (raw ? { value: raw } : { error: 'Informe o nome.' }), prompt: 'Qual o nome?' },
          {
            id: 'sex',
            options: [{ label: 'Masculino', value: 'MALE' }],
            optional: true,
            parse: raw => ({ value: raw }),
            prompt: 'Qual o sexo?',
          },
        ],
        submit: () => submit(),
        successMessage: 'Feito',
        title: 'Cadastrar',
      },
      id: 'chat',
      label: 'Cadastrar',
    };
    const buttons = (): string[] =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('button')).map(b => b.textContent?.trim() ?? '');

    beforeEach(() => jasmine.clock().install());

    afterEach(() => jasmine.clock().uninstall());

    it('shows the question, answers and errors; options and skip live in the chips above the message field', () => {
      const flow = TestBed.inject(AssistantConversationService);

      assistant.openAction(chat);
      fixture.detectChanges();
      finishTyping();

      // A pergunta da IA é texto corrido regular (padrão de ferramentas de IA), com a digitação por cima.
      expect(Array.from(el().querySelectorAll('.assistant-content__ask')).at(-1)?.textContent).toContain(
        'Qual o nome?',
      );
      assistant.ask('');
      assistant.ask('Ana');
      fixture.detectChanges();

      expect(text('.assistant-content__question')).toBe('—');
      expect(text('[role="alert"]')).toBe('Informe o nome.');
      // As opções não são mais botões de 100% no conteúdo: viram chips junto do campo de mensagem.
      expect(buttons()).toEqual([]);
      expect(flow.options().map(o => o.label)).toEqual(['Masculino']);
      expect(flow.canSkip()).toBeTrue();
      flow.choose(flow.options()[0]);
      flow.skip();
      fixture.detectChanges();

      expect(submit).toHaveBeenCalledWith();
    });

    /** Guarda os quadros pedidos e os roda sob demanda (a mensagem só entra no DOM depois do efeito). */
    const fakeFrames = (): { run: () => void } => {
      const pending: FrameRequestCallback[] = [];

      spyOn(window, 'requestAnimationFrame').and.callFake((callback: FrameRequestCallback): number => {
        pending.push(callback);

        return pending.length;
      });

      return {
        run: (): void => {
          while (pending.length > 0) {
            pending.shift()?.(0);
          }
        },
      };
    };

    it('a última resposta do usuário sobe ao topo da tela (sem área rolável por perto)', () => {
      const frames = fakeFrames();

      spyOn(Element.prototype, 'scrollIntoView');
      assistant.openAction(chat);
      fixture.detectChanges();
      finishTyping();
      assistant.ask('Ana');
      fixture.detectChanges();
      frames.run();

      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    it('com uma área rolável por perto, rola o contêiner até o balão', () => {
      const frames = fakeFrames();

      spyOn(HTMLElement.prototype, 'scrollTo');
      assistant.openAction(chat);
      fixture.detectChanges();
      finishTyping();
      // O próprio conteúdo faz o papel da área rolável (overflow-y: auto).
      (el().querySelector('.assistant-content') as HTMLElement).style.overflowY = 'auto';
      assistant.ask('Ana');
      fixture.detectChanges();
      frames.run();

      expect(HTMLElement.prototype.scrollTo as jasmine.Spy).toHaveBeenCalledWith(
        jasmine.objectContaining({ behavior: 'smooth' }),
      );
    });

    it('mostra "Pensando…" enquanto a IA prepara a próxima pergunta', () => {
      const flow = TestBed.inject(AssistantConversationService);

      flow.thinkingMs = 600;
      assistant.openAction(chat);
      fixture.detectChanges();
      finishTyping();
      assistant.ask('Ana');
      fixture.detectChanges();

      expect(text('.assistant-content__thinking')).toContain('Pensando');
      expect(flow.options()).toEqual([]);
      jasmine.clock().tick(700);
      fixture.detectChanges();

      expect(el().querySelector('.assistant-content__thinking')).toBeNull();
      expect(flow.options().map(o => o.label)).toEqual(['Masculino']);
    });

    it('offers a retry after a failed submit (chip above the message field)', async () => {
      const flow = TestBed.inject(AssistantConversationService);

      submit.and.rejectWith(new Error('x'));
      assistant.openAction(chat);
      assistant.ask('Ana');
      assistant.ask('');
      fixture.detectChanges();
      finishTyping();
      await Promise.resolve();
      fixture.detectChanges();
      submit.and.resolveTo();

      expect(flow.canRetry()).toBeTrue();
      flow.retry();
      await Promise.resolve();
      fixture.detectChanges();

      expect(Array.from(el().querySelectorAll('.assistant-content__ask')).at(-1)?.textContent).toContain('Feito');
    });
  });
});
