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

  it('mostra "Atalhos" na visão de atalhos, no lugar do logo', () => {
    assistant.openShortcuts();
    fixture.detectChanges();

    expect(title()).toBe('Atalhos');
  });

  it('num cadastro o título sai do cabeçalho (vira o texto digitado no conteúdo)', () => {
    assistant.openAction(withForm);
    fixture.detectChanges();

    expect(title()).toBe('');
  });

  it('também fica vazio num cadastro sem formulário', () => {
    assistant.openAction(plain);
    fixture.detectChanges();

    expect(title()).toBe('');
  });

  it('is empty without an action and has no back arrow (the header is logo + title + close)', () => {
    fixture.detectChanges();

    expect(title()).toBe('');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
