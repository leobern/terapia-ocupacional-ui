import { TestBed } from '@angular/core/testing';

import { AiAssistantService } from './ai-assistant.service';
import { type ScreenAction } from './screen-actions.service';

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
});
