import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { type ActiveAssistantForm, AssistantFormController } from './assistant-form-controller.service';

describe('AssistantFormController', () => {
  const make = (): ActiveAssistantForm => ({
    canSubmit: signal(true),
    label: signal('x'),
    submit: () => Promise.resolve(),
  });

  it('keeps the attached form and clears it on detach', () => {
    const controller = TestBed.inject(AssistantFormController);
    const form = make();
    const detach = controller.attach(form);

    expect(controller.active()).toBe(form);

    detach();

    expect(controller.active()).toBeNull();
  });

  it('a stale detach does not remove a newer form', () => {
    const controller = TestBed.inject(AssistantFormController);
    const detachOld = controller.attach(make());
    const newer = make();

    controller.attach(newer);
    detachOld();

    expect(controller.active()).toBe(newer);
  });
});
