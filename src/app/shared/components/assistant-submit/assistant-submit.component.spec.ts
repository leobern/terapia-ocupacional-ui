import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { AssistantFormController } from '../../services/assistant-form-controller.service';
import { AssistantSubmitComponent } from './assistant-submit.component';

describe('AssistantSubmitComponent', () => {
  let fixture: ComponentFixture<AssistantSubmitComponent>;
  let controller: AssistantFormController;
  const button = (): HTMLButtonElement | null => fixture.nativeElement.querySelector('button');

  beforeEach(() => {
    controller = TestBed.inject(AssistantFormController);
    fixture = TestBed.createComponent(AssistantSubmitComponent);
    fixture.detectChanges();
  });

  it('renders nothing without an open form', () => {
    expect(button()).toBeNull();
  });

  it('shows the form label, disabled until it can be submitted, and triggers the submit', () => {
    const canSubmit = signal(false);
    const submit = jasmine.createSpy('submit').and.resolveTo();

    controller.attach({ canSubmit, label: signal('Criar notificação'), submit });
    fixture.detectChanges();

    expect(button()?.textContent).toContain('Criar notificação');
    expect(button()?.disabled).toBeTrue();

    canSubmit.set(true);
    fixture.detectChanges();
    button()?.click();

    expect(submit).toHaveBeenCalledWith();
  });

  it('disappears when the form detaches', () => {
    const detach = controller.attach({
      canSubmit: signal(true),
      label: signal('Criar'),
      submit: () => Promise.resolve(),
    });

    detach();
    fixture.detectChanges();

    expect(button()).toBeNull();
  });
});
