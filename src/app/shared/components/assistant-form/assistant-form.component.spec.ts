import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { AssistantFormController } from '../../services/assistant-form-controller.service';
import { FormAssistant } from '../../services/form-assistant';
import { type FormActionDefinition, FormSubmitError, type FormValues } from '../../services/screen-actions.service';
import { type DirectoryUser, UserDirectory } from '../../services/user-directory';
import { AssistantFormComponent } from './assistant-form.component';

const USERS: DirectoryUser[] = [
  { id: 1, name: 'Jairo Nepomuceno', photoUrl: null, specialty: 'Enfermeiro' },
  { id: 2, name: 'Filippa Martins', photoUrl: null, specialty: 'Nutricionista' },
];

/** Grupos só aparecem quando o termo digitado os alcança (mantém as listas das pessoas intactas nos outros testes). */
const GROUPS: DirectoryUser[] = [
  { group: { memberCount: 3, profile: 'medicos' }, id: -2, name: 'medicos', photoUrl: null, specialty: 'Grupo' },
  { group: { memberCount: 0, profile: 'psicologos' }, id: -3, name: 'psicologos', photoUrl: null, specialty: 'Grupo' },
];

class FakeDirectory extends UserDirectory {
  terms: string[] = [];

  search(term: string): Promise<readonly DirectoryUser[]> {
    this.terms.push(term);

    const all = term === '' ? USERS : [...USERS, ...GROUPS];

    return Promise.resolve(all.filter(user => user.name.toLowerCase().includes(term.toLowerCase())));
  }
}

class FakeAssistant extends FormAssistant {
  result: FormValues | null = null;
  calls: unknown[] = [];

  fill(_: FormActionDefinition, input: unknown): Promise<FormValues | null> {
    this.calls.push(input);

    return Promise.resolve(this.result);
  }
}

describe('AssistantFormComponent', () => {
  let fixture: ComponentFixture<AssistantFormComponent>;
  let directory: FakeDirectory;
  let saved: FormValues | null;
  let failing: boolean;
  let failWithReason: boolean;
  let requiredMessage: string | undefined;

  const definition = (): FormActionDefinition => ({
    fields: [
      { id: 'who', kind: 'mention', label: 'Quem?', placeholder: '@nome', required: true, requiredMessage },
      { id: 'text', kind: 'text', label: 'Mensagem?', placeholder: 'Escreva', required: true },
      { id: 'date', kind: 'date', label: 'Data?', placeholder: 'Selecione', required: false },
    ],
    submit: (values): void => {
      if (failWithReason) {
        throw new FormSubmitError('Sem conexão.');
      }
      if (failing) {
        throw new Error('fail');
      }
      saved = values;
    },
    submitLabel: 'Criar',
    title: 'Criar',
  });

  const el = (): HTMLElement => fixture.nativeElement;
  const input = (index: number): HTMLInputElement =>
    el().querySelectorAll<HTMLInputElement>('.assistant-form__input')[index];
  const type = async (index: number, value: string): Promise<void> => {
    input(index).value = value;
    input(index).dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  // O botão de envio fica DENTRO do formulário e só existe com todas as perguntas obrigatórias respondidas.
  const button = (): HTMLButtonElement | null => el().querySelector('.assistant-form__submit app-button button');
  const footer = (): { click: () => Promise<void> } => ({
    click: async (): Promise<void> => {
      button()?.click();
      await fixture.whenStable();
    },
  });
  const submit = (): { disabled: boolean; textContent: string } => ({
    disabled: button() === null,
    textContent: button()?.textContent ?? '',
  });
  const suggestions = (): string[] =>
    Array.from(el().querySelectorAll('.assistant-form__suggestion-name')).map(e => e.textContent?.trim() ?? '');
  const pick = async (): Promise<void> => {
    (el().querySelector('.assistant-form__suggestion') as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    directory = new FakeDirectory();
    saved = null;
    failing = false;
    failWithReason = false;
    requiredMessage = 'Informe ao menos um destinatário.';
    await TestBed.configureTestingModule({
      imports: [AssistantFormComponent],
      providers: [
        { provide: UserDirectory, useValue: directory },
        { provide: FormAssistant, useClass: FakeAssistant },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AssistantFormComponent);
    fixture.componentRef.setInput('definition', definition());
    fixture.detectChanges();
  });

  it('renders one card per question, all open, and shows no submit button until the required ones are answered', () => {
    expect(el().querySelectorAll('app-accordion').length).toBe(3);
    expect(Array.from(el().querySelectorAll('.accordion__header')).map(h => h.getAttribute('aria-expanded'))).toEqual([
      'true',
      'true',
      'true',
    ]);

    expect(submit().disabled).toBeTrue();
  });

  it('aviso com saída mostra o botão, que some junto com o aviso', async () => {
    const run = jasmine.createSpy('run');

    fixture.componentRef.setInput('definition', {
      fields: [{ id: 'nome', kind: 'text', label: 'Nome', placeholder: '', required: true }],
      submit: (): never => {
        throw new FormSubmitError('Já existe.', { label: 'Resolver', run });
      },
      submitLabel: 'Enviar',
      title: 'Teste',
    });
    fixture.detectChanges();
    const action = (): HTMLButtonElement | null => el().querySelector('.assistant-form__error-action button');

    await type(0, 'x');
    button()?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    action()?.click();

    expect(run).toHaveBeenCalledTimes(1);

    await type(0, 'y');

    expect(action()).toBeNull();
  });

  it('typing @ opens the registered users and each letter after it narrows the list', async () => {
    await type(0, '@');

    expect(suggestions()).toEqual(['Jairo Nepomuceno', 'Filippa Martins']);

    await type(0, '@jai');

    expect(suggestions()).toEqual(['Jairo Nepomuceno']);
    expect(directory.terms).toEqual(['', 'jai']);
  });

  it('does not open the list without an @, and closes it when the @ token is gone', async () => {
    await type(0, 'jai');

    expect(el().querySelector('.assistant-form__suggestions')).toBeNull();

    await type(0, '@jai');
    await type(0, 'jai');

    expect(el().querySelector('.assistant-form__suggestions')).toBeNull();
  });

  it('tells when nobody matches', async () => {
    await type(0, '@zzz');

    expect(el().querySelector('.assistant-form__suggestions-empty')?.textContent).toContain('Nenhum usuário');
  });

  it('picking a user marks them, clears the typed token and hides them from the next search', async () => {
    await type(0, '@jai');
    await pick();

    expect(Array.from(el().querySelectorAll('.assistant-form__chip')).map(c => c.textContent?.trim())).toEqual([
      'Jairo Nepomuceno',
    ]);

    expect(input(0).value).toBe('');

    await type(0, '@');

    expect(suggestions()).toEqual(['Filippa Martins']);
  });

  it('um grupo marcado aparece com @ e a quantidade de pessoas atingidas', async () => {
    await type(0, '@medi');
    await pick();

    expect(el().querySelector('.assistant-form__chip')?.textContent?.trim()).toBe('@medicos (3)');
    expect(el().querySelector('.assistant-form__hint')).toBeNull();
  });

  it('grupo sem nenhum profissional vinculado avisa e impede o envio até ser removido', async () => {
    await type(0, '@psico');
    await pick();
    await type(1, 'Aviso');

    expect(el().querySelector('.assistant-form__hint')?.textContent).toContain('@psicologos');
    expect(submit().disabled).toBeTrue();

    (el().querySelector('.assistant-form__chip-remove') as HTMLButtonElement).click();
    await type(0, '@jai');
    await pick();

    expect(submit().disabled).toBeFalse();
  });

  it('a marked user can be removed', async () => {
    await type(0, '@jai');
    await pick();
    (el().querySelector('.assistant-form__chip-remove') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el().querySelectorAll('.assistant-form__chip').length).toBe(0);
    expect(submit().disabled).toBeTrue();
  });

  it('enables submit only when the required questions are answered (the date is optional)', async () => {
    await type(0, '@jai');
    await pick();

    expect(submit().disabled).toBeTrue();

    await type(1, 'Revisar prescrição');

    expect(submit().disabled).toBeFalse();
    expect(submit().textContent).toContain('Criar');
  });

  it('unregisters from the footer when destroyed', () => {
    fixture.destroy();

    expect(TestBed.inject(AssistantFormController).active()).toBeNull();
  });

  it('ignores a submit while required answers are missing', async () => {
    await fixture.componentInstance.onSubmit();

    expect(saved).toBeNull();
  });

  it('the date field does not accept days in the past', () => {
    expect(input(2).min).toBe(new Date().toISOString().slice(0, 10));
  });

  it('submits the answers, emits submitted and clears the form', async () => {
    let emitted = 0;

    fixture.componentInstance.submitted.subscribe(() => emitted++);
    await type(0, '@jai');
    await pick();
    await type(1, '  Revisar  ');
    await type(2, '2030-05-04');
    await footer().click();
    fixture.detectChanges();

    expect(saved).toEqual({ date: '2030-05-04', text: 'Revisar', who: [USERS[0]] });
    expect(emitted).toBe(1);
    expect(input(1).value).toBe('');
    expect(submit().disabled).toBeTrue();
  });

  it('keeps the answers and shows an error when saving fails', async () => {
    failing = true;
    await type(0, '@jai');
    await pick();
    await type(1, 'Revisar');
    await footer().click();
    fixture.detectChanges();

    expect(el().querySelector('.assistant-form__error')?.textContent).toContain('Não foi possível salvar');
    expect(input(1).value).toBe('Revisar');
  });

  it('shows the reason while a required question with requiredMessage is unanswered', async () => {
    expect(el().querySelector('.assistant-form__hint')?.textContent).toContain('Informe ao menos um destinatário.');
    await type(0, '@jai');
    await pick();

    expect(el().querySelector('.assistant-form__hint')).toBeNull();
  });

  it('shows the message of a FormSubmitError and keeps the answers', async () => {
    failWithReason = true;
    await type(0, '@jai');
    await pick();
    await type(1, 'Revisar');
    await footer().click();
    fixture.detectChanges();

    expect(el().querySelector('.assistant-form__error')?.textContent).toContain('Sem conexão.');
    expect(input(1).value).toBe('Revisar');
  });

  it('closing a card with an answer summarises it, and without an answer leaves it empty', async () => {
    await type(1, 'Revisar');
    const headers = el().querySelectorAll<HTMLButtonElement>('.accordion__header');

    headers[1].click();
    headers[2].click();
    fixture.detectChanges();
    const accordions = Array.from(el().querySelectorAll('app-accordion'));

    expect(accordions[1].querySelector('.assistant-form__answer')?.textContent).toContain('Revisar');
    expect(headers[1].getAttribute('aria-expanded')).toBe('false');
    expect(accordions[2].querySelector('.accordion__placeholder')).toBeTruthy();

    headers[1].click();
    fixture.detectChanges();

    expect(headers[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('formats the chosen date as dd/mm/yyyy in the summary', async () => {
    await type(2, '2030-05-04');
    el().querySelectorAll<HTMLButtonElement>('.accordion__header')[2].click();
    fixture.detectChanges();

    expect(el().querySelectorAll('.assistant-form__answer')[2].textContent).toContain('04/05/30');
  });

  describe('preenchimento por IA (apply)', () => {
    it('aplica texto, data e usuários marcados, ignora campos desconhecidos, e libera o envio', async () => {
      fixture.componentInstance.apply({ date: '2026-12-01', text: 'Revisar', unknown: 'x', who: [USERS[0]] });
      fixture.detectChanges();

      expect(el().querySelector('.assistant-form__chip')?.textContent).toContain('Jairo Nepomuceno');
      expect(submit().disabled).toBeFalse();
    });

    it('um valor ausente não apaga o que o usuário já preencheu', async () => {
      await type(1, 'Meu texto');
      fixture.componentInstance.apply({ who: [USERS[1]] });
      fixture.detectChanges();

      expect(input(1).value).toBe('Meu texto');
    });
  });

  it('o rodapé aciona o preenchimento pelo controlador: com IA os campos são preenchidos', async () => {
    const controller = TestBed.inject(AssistantFormController);
    const assistant = TestBed.inject(FormAssistant) as FakeAssistant;

    assistant.result = { text: 'Preenchido pela IA', who: [USERS[0]] };
    const done = await controller.assist({ text: 'avisar o Jairo' });

    fixture.detectChanges();

    expect(done).toBeTrue();
    expect(assistant.calls.length).toBe(1);
    expect(submit().disabled).toBeFalse();
  });

  describe('sugestão de destinatários', () => {
    let suggest: () => Promise<readonly DirectoryUser[]>;
    const chips = (label: string): string[] =>
      Array.from(el().querySelectorAll(`[aria-label="${label}"] .assistant-form__chip span`)).map(
        e => e.textContent?.trim() ?? '',
      );
    const blurMessage = async (value: string): Promise<void> => {
      await type(1, value);
      input(1).dispatchEvent(new Event('blur'));
      await fixture.whenStable();
      fixture.detectChanges();
    };

    beforeEach(() => {
      suggest = (): Promise<readonly DirectoryUser[]> => Promise.resolve([USERS[0], USERS[1]]);
      const base = definition();

      fixture = TestBed.createComponent(AssistantFormComponent);
      fixture.componentRef.setInput('definition', {
        ...base,
        fields: [
          { ...base.fields[0], suggest: { from: 'text', run: (): Promise<readonly DirectoryUser[]> => suggest() } },
          ...base.fields.slice(1),
        ],
      });
      fixture.detectChanges();
    });

    it('apresenta sugestões marcadas como sugestão sem liberar o envio', async () => {
      await blurMessage('Aviso');

      expect(chips('Sugeridos')).toEqual(['Jairo Nepomuceno · sugerido', 'Filippa Martins · sugerido']);
      expect(submit().disabled).toBeTrue();
    });

    it('confirmar as sugestões as torna destinatários e libera o envio', async () => {
      await blurMessage('Aviso');
      (el().querySelector('.assistant-form__confirm') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(chips('Marcados')).toEqual(['Jairo Nepomuceno', 'Filippa Martins']);
      expect(el().querySelector('[aria-label="Sugeridos"]')).toBeNull();
      expect(submit().disabled).toBeFalse();
    });

    it('descartar uma sugestão mantém só as demais; descartar todas mantém o envio impedido', async () => {
      await blurMessage('Aviso');
      (el().querySelector('[aria-label="Descartar sugestão Jairo Nepomuceno"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(chips('Sugeridos')).toEqual(['Filippa Martins · sugerido']);

      (el().querySelector('[aria-label="Descartar sugestão Filippa Martins"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(el().querySelector('.assistant-form__confirm')).toBeNull();
      expect(submit().disabled).toBeTrue();
    });

    it('com a IA indisponível avisa discretamente e o fluxo manual continua', async () => {
      suggest = (): Promise<readonly DirectoryUser[]> => Promise.reject(new Error('fora do ar'));
      await blurMessage('Aviso');

      expect(el().textContent).toContain('Sugestão automática indisponível');

      await type(0, '@jai');
      await pick();

      expect(submit().disabled).toBeFalse();
    });

    it('não sugere quando já há destinatário marcado ou o texto está vazio', async () => {
      const suggestSpy = jasmine.createSpy('suggestSpy').and.callFake(() => Promise.resolve([USERS[0]]));

      suggest = suggestSpy;
      await blurMessage('  ');
      await type(0, '@jai');
      await pick();
      await blurMessage('Aviso');

      expect(suggestSpy).not.toHaveBeenCalled();
    });
  });

  describe('conteúdo pré-preenchido', () => {
    it('mostra o texto inicial editável, o aviso e já pede sugestão de destinatários', async () => {
      const run = jasmine.createSpy('run').and.resolveTo([USERS[0]]);
      const base = definition();

      fixture = TestBed.createComponent(AssistantFormComponent);
      fixture.componentRef.setInput('definition', {
        ...base,
        fields: [{ ...base.fields[0], suggest: { from: 'text', run } }, ...base.fields.slice(1)],
        initialValues: { text: 'Estoque baixo' },
        notice: 'Aviso de teste',
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el().textContent).toContain('Aviso de teste');
      expect(input(1).value).toBe('Estoque baixo');
      expect(run).toHaveBeenCalledWith('Estoque baixo');
      expect(el().textContent).toContain('sugerido');
    });
  });
});
