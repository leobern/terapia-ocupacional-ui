import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { AiAssistantService } from '../../services/ai-assistant.service';
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
