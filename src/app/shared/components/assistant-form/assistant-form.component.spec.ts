import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { AssistantFormController } from '../../services/assistant-form-controller.service';
import { type FormActionDefinition, type FormValues } from '../../services/screen-actions.service';
import { type DirectoryUser, UserDirectory } from '../../services/user-directory';
import { AssistantFormComponent } from './assistant-form.component';

const USERS: DirectoryUser[] = [
  { id: 1, name: 'Jairo Nepomuceno', photoUrl: null, specialty: 'Enfermeiro' },
  { id: 2, name: 'Filippa Martins', photoUrl: null, specialty: 'Nutricionista' },
];

class FakeDirectory extends UserDirectory {
  terms: string[] = [];

  search(term: string): Promise<readonly DirectoryUser[]> {
    this.terms.push(term);

    return Promise.resolve(USERS.filter(user => user.name.toLowerCase().includes(term.toLowerCase())));
  }
}

describe('AssistantFormComponent', () => {
  let fixture: ComponentFixture<AssistantFormComponent>;
  let directory: FakeDirectory;
  let saved: FormValues | null;
  let failing: boolean;

  const definition = (): FormActionDefinition => ({
    fields: [
      { id: 'who', kind: 'mention', label: 'Quem?', placeholder: '@nome', required: true },
      { id: 'text', kind: 'text', label: 'Mensagem?', placeholder: 'Escreva', required: true },
      { id: 'date', kind: 'date', label: 'Data?', placeholder: 'Selecione', required: false },
    ],
    submit: (values): void => {
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
  const footer = (): { label: string; disabled: boolean; click: () => Promise<void> } => {
    const form = TestBed.inject(AssistantFormController).active();

    return {
      click: () => form?.submit() ?? Promise.resolve(),
      disabled: !form?.canSubmit(),
      label: form?.label() ?? '',
    };
  };
  const submit = (): { disabled: boolean; textContent: string; click: () => void } => {
    const f = footer();

    return { click: () => void f.click(), disabled: f.disabled, textContent: f.label };
  };
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
    await TestBed.configureTestingModule({
      imports: [AssistantFormComponent],
      providers: [{ provide: UserDirectory, useValue: directory }],
    }).compileComponents();
    fixture = TestBed.createComponent(AssistantFormComponent);
    fixture.componentRef.setInput('definition', definition());
    fixture.detectChanges();
  });

  it('renders one card per question, all open, and registers a disabled submit with the footer', () => {
    expect(el().querySelectorAll('app-accordion').length).toBe(3);
    expect(Array.from(el().querySelectorAll('.accordion__header')).map(h => h.getAttribute('aria-expanded'))).toEqual([
      'true',
      'true',
      'true',
    ]);

    expect(submit().disabled).toBeTrue();
    expect(submit().textContent).toContain('Criar');
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
  });

  it('unregisters from the footer when destroyed', () => {
    fixture.destroy();

    expect(TestBed.inject(AssistantFormController).active()).toBeNull();
  });

  it('ignores a submit while required answers are missing', async () => {
    await footer().click();

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

    expect(el().querySelectorAll('.assistant-form__answer')[2].textContent).toContain('04/05/2030');
  });
});
