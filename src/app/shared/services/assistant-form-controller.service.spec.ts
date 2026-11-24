import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  type ActiveAssistantForm,
  ASSIST_UNAVAILABLE_HINT,
  AssistantFormController,
} from './assistant-form-controller.service';
import { FormAssistant } from './form-assistant';
import { type FormActionDefinition, type FormValues } from './screen-actions.service';

const definition: FormActionDefinition = { fields: [], submit: (): void => undefined, submitLabel: 'x', title: 'x' };

class FakeAssistant extends FormAssistant {
  mode: 'values' | 'null' | 'throw' = 'values';

  fill(): Promise<FormValues | null> {
    if (this.mode === 'throw') {
      return Promise.reject(new Error('x'));
    }

    return Promise.resolve(this.mode === 'null' ? null : { text: 'ok' });
  }
}

describe('AssistantFormController', () => {
  let applied: FormValues[];
  const make = (): ActiveAssistantForm => ({
    apply: (values): void => {
      applied.push(values);
    },
    definition: signal(definition),
  });

  beforeEach(() => {
    applied = [];
    TestBed.configureTestingModule({ providers: [{ provide: FormAssistant, useClass: FakeAssistant }] });
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

  it('assist applies the values the AI returns to the open form', async () => {
    const controller = TestBed.inject(AssistantFormController);

    controller.attach(make());

    expect(await controller.assist({ text: 'oi' })).toBeTrue();
    expect(applied).toEqual([{ text: 'ok' }]);
    expect(controller.assistHint()).toBeNull();
    expect(controller.assisting()).toBeFalse();
  });

  it('assist without values (AI unavailable) warns and leaves the form alone', async () => {
    const controller = TestBed.inject(AssistantFormController);

    (TestBed.inject(FormAssistant) as FakeAssistant).mode = 'null';
    controller.attach(make());

    expect(await controller.assist({ text: 'oi' })).toBeFalse();
    expect(controller.assistHint()).toBe(ASSIST_UNAVAILABLE_HINT);
    expect(applied).toEqual([]);
  });

  it('assist that throws warns instead of failing', async () => {
    const controller = TestBed.inject(AssistantFormController);

    (TestBed.inject(FormAssistant) as FakeAssistant).mode = 'throw';
    controller.attach(make());

    expect(await controller.assist({ audio: new Blob(['a']) })).toBeFalse();
    expect(controller.assistHint()).toBe(ASSIST_UNAVAILABLE_HINT);
  });

  it('assist without an open form does nothing', async () => {
    expect(await TestBed.inject(AssistantFormController).assist({ text: 'oi' })).toBeFalse();
  });

  it('assist without any FormAssistant provided warns (V1 without AI)', async () => {
    TestBed.resetTestingModule();
    const controller = TestBed.inject(AssistantFormController);

    controller.attach(make());

    expect(await controller.assist({ text: 'oi' })).toBeFalse();
    expect(controller.assistHint()).toBe(ASSIST_UNAVAILABLE_HINT);
  });

  it('a new form clears a previous warning', async () => {
    const controller = TestBed.inject(AssistantFormController);

    (TestBed.inject(FormAssistant) as FakeAssistant).mode = 'null';
    controller.attach(make());
    await controller.assist({ text: 'oi' });
    controller.attach(make());

    expect(controller.assistHint()).toBeNull();
  });
});
