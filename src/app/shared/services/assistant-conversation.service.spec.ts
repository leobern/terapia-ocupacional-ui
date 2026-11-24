import { TestBed } from '@angular/core/testing';

import { AssistantConversationService } from './assistant-conversation.service';
import { type ConversationDefinition, ConversationStepError } from './screen-actions.service';

describe('AssistantConversationService', () => {
  let service: AssistantConversationService;
  let submit: jasmine.Spy;
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve));
  const definition = (): ConversationDefinition => ({
    errorMessage: 'falhou',
    skipLabel: 'Pular',
    steps: [
      { id: 'a', parse: raw => (raw === 'ok' ? { value: 'OK' } : { error: 'erro a' }), prompt: 'pergunta a' },
      { id: 'b', optional: true, parse: raw => ({ value: raw }), prompt: 'pergunta b' },
    ],
    submit: values => submit(values),
    successMessage: 'pronto',
    title: 'Teste',
  });

  beforeEach(() => {
    submit = jasmine.createSpy('submit').and.resolveTo();
    service = TestBed.inject(AssistantConversationService);
  });

  it('ignores answers before it starts, and exposes empty state', () => {
    service.answer('x');
    service.skip();
    service.retry();

    expect(service.messages()).toEqual([]);
    expect(service.options()).toEqual([]);
    expect(service.skipLabel()).toBe('');
  });

  it('repeats a question after an invalid answer, then advances and submits', async () => {
    service.start(definition());
    service.answer('nope');

    expect(service.messages().map(m => m.text)).toEqual(['pergunta a', 'nope', 'erro a', 'pergunta a']);
    service.answer('ok');

    expect(service.canSkip()).toBeTrue();
    expect(service.skipLabel()).toBe('Pular');
    service.skip();
    await settle();

    expect(submit).toHaveBeenCalledOnceWith({ a: 'OK', b: '' });
    expect(service.messages().at(-1)).toEqual({ role: 'assistant', text: 'pronto', tone: 'success' });
    expect(service.currentStep()).toBeNull();
  });

  it('ignores answers while submitting', async () => {
    let release!: () => void;

    submit.and.returnValue(
      new Promise<void>(resolve => {
        release = resolve;
      }),
    );
    service.start(definition());
    service.answer('ok');
    service.answer('');

    expect(service.submitting()).toBeTrue();
    service.answer('x');
    service.retry();
    release();
    await settle();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(service.submitting()).toBeFalse();
  });

  it('a step error for an unknown step is a generic failure', async () => {
    submit.and.rejectWith(new ConversationStepError('zzz', 'x'));
    service.start(definition());
    service.answer('ok');
    service.answer('');
    await settle();

    expect(service.canRetry()).toBeTrue();
    expect(service.messages().at(-1)).toEqual({ role: 'assistant', text: 'falhou', tone: 'error' });
  });

  it('reset during a pending submit discards its result', async () => {
    let release!: () => void;

    submit.and.returnValue(
      new Promise<void>(resolve => {
        release = resolve;
      }),
    );
    service.start(definition());
    service.answer('ok');
    service.answer('');
    service.reset();
    release();
    await settle();

    expect(service.messages()).toEqual([]);
    expect(service.finished()).toBeFalse();
  });

  it('reset during a pending failing submit discards the error', async () => {
    let fail!: () => void;

    submit.and.returnValue(
      new Promise<void>((_, reject) => {
        fail = (): void => reject(new Error('x'));
      }),
    );
    service.start(definition());
    service.answer('ok');
    service.answer('');
    service.reset();
    fail();
    await settle();

    expect(service.canRetry()).toBeFalse();
  });

  it('skips conditional steps whose `when` is false and asks them when it is true', async () => {
    const conditional = (): ConversationDefinition => ({
      ...definition(),
      steps: [
        { id: 'a', parse: raw => ({ value: raw }), prompt: 'pergunta a' },
        { id: 'b', parse: raw => ({ value: raw }), prompt: 'pergunta b', when: values => values['a'] === 'sim' },
      ],
    });

    service.start(conditional());
    service.answer('não');
    await settle();

    expect(submit).toHaveBeenCalledOnceWith({ a: 'não' });

    service.start(conditional());
    service.answer('sim');

    expect(service.currentStep()?.id).toBe('b');
  });
});
