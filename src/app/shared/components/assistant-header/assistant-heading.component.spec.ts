import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { AiAssistantService } from '../../services/ai-assistant.service';
import { type ScreenAction } from '../../services/screen-actions.service';
import { AssistantHeadingComponent } from './assistant-heading.component';

describe('AssistantHeadingComponent', () => {
  let fixture: ComponentFixture<AssistantHeadingComponent>;
  let assistant: AiAssistantService;
  const withForm: ScreenAction = {
    form: { fields: [], submit: (): void => undefined, submitLabel: 'Criar', title: 'Criar notificação' },
    id: 'create',
    label: 'Criar',
  };
  const plain: ScreenAction = { id: 'edit', label: 'Editar notificação' };
  const title = (): string => fixture.nativeElement.querySelector('.assistant-heading__title')?.textContent?.trim();

  beforeEach(() => {
    assistant = TestBed.inject(AiAssistantService);
    fixture = TestBed.createComponent(AssistantHeadingComponent);
  });

  it('shows the form title', () => {
    assistant.openAction(withForm);
    fixture.detectChanges();

    expect(title()).toBe('Criar notificação');
  });

  it('falls back to the action label when there is no form', () => {
    assistant.openAction(plain);
    fixture.detectChanges();

    expect(title()).toBe('Editar notificação');
  });

  it('is empty without an action, and the back arrow returns to the shortcuts', () => {
    fixture.detectChanges();

    expect(title()).toBe('');

    assistant.openAction(plain);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Voltar para os atalhos"]').click();

    expect(assistant.view()).toBe('shortcuts');
  });
});
