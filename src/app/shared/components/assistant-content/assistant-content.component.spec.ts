import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { AiAssistantService } from '../../services/ai-assistant.service';
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
    expect(text('.assistant-content__hint')).toContain('texto ou áudio');
  });

  it('chat: shows at least two suggestion chips, including the pending-tasks one', () => {
    const chips = Array.from(el().querySelectorAll('.assistant-content__chip')).map(b => b.textContent?.trim());

    expect(chips.length).toBeGreaterThanOrEqual(2);
    expect(chips).toContain('Quais são minhas pendências de hoje?');
  });

  it('tapping a chip sends exactly that question', () => {
    const chip = Array.from(el().querySelectorAll<HTMLButtonElement>('.assistant-content__chip')).find(
      b => b.textContent?.trim() === 'Quais são minhas pendências de hoje?',
    );

    chip?.click();

    expect(assistant.lastQuestion()).toBe('Quais são minhas pendências de hoje?');
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

    expect(text('.assistant-content__title')).toBe('Atalhos');
    expect(text('.assistant-content__body')).toContain('Qual ação você deseja executar nessa tela');
    expect(
      Array.from(el().querySelectorAll('.assistant-content__actions button')).map(b => b.textContent?.trim()),
    ).toEqual(['Criar notificação', 'Editar notificação']);
  });

  it('shortcuts: says so when the screen has no actions', () => {
    TestBed.inject(ScreenActionsService).register([]);
    assistant.openShortcuts();
    fixture.detectChanges();

    expect(text('.assistant-content__actions')).toContain('Nenhuma ação disponível');
  });

  it('choosing a registration opens its form with a back arrow and the form title', () => {
    assistant.openShortcuts();
    fixture.detectChanges();
    (el().querySelectorAll('.assistant-content__actions button')[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(text('.assistant-content__title')).toBe('Criar notificação');
    expect(el().querySelector('app-assistant-form')).toBeTruthy();
    expect(el().querySelector('button[aria-label="Voltar para os atalhos"]')).toBeTruthy();
  });

  it('the back arrow returns to the shortcuts', () => {
    assistant.openAction(create);
    fixture.detectChanges();
    (el().querySelector('button[aria-label="Voltar para os atalhos"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(text('.assistant-content__title')).toBe('Atalhos');
  });

  it('an action without a form says it is not available yet, with a way back', () => {
    assistant.openAction(edit);
    fixture.detectChanges();

    expect(text('.assistant-content__title')).toBe('Editar notificação');
    expect(text('.assistant-content__body')).toContain('ainda não está disponível');

    (el().querySelector('button[aria-label="Voltar para os atalhos"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(text('.assistant-content__title')).toBe('Atalhos');
  });

  it('after the registration is saved the panel goes back to the shortcuts', () => {
    assistant.openAction(create);
    fixture.detectChanges();
    fixture.debugElement.query(By.directive(AssistantFormComponent)).componentInstance.submitted.emit();
    fixture.detectChanges();

    expect(assistant.view()).toBe('shortcuts');
  });
});
