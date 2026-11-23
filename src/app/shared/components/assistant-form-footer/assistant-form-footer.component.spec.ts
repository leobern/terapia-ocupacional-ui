import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { AssistantFormController } from '../../services/assistant-form-controller.service';
import { FormAssistant } from '../../services/form-assistant';
import { type FormActionDefinition, type FormValues } from '../../services/screen-actions.service';
import { AssistantFormFooterComponent } from './assistant-form-footer.component';

class FakeAssistant extends FormAssistant {
  result: FormValues | null = { text: 'x' };
  calls: unknown[] = [];

  fill(_: FormActionDefinition, input: unknown): Promise<FormValues | null> {
    this.calls.push(input);

    return Promise.resolve(this.result);
  }
}

describe('AssistantFormFooterComponent', () => {
  let fixture: ComponentFixture<AssistantFormFooterComponent>;
  let assistant: FakeAssistant;
  let controller: AssistantFormController;

  const form = (extra: Partial<FormActionDefinition> = {}): FormActionDefinition => ({
    fields: [],
    submit: (): void => undefined,
    submitLabel: 'Criar',
    title: 'Criar',
    ...extra,
  });
  const el = (): HTMLElement => fixture.nativeElement;
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();
  };
  const attach = (definition: FormActionDefinition): void => {
    controller.attach({ apply: (): void => undefined, definition: signal(definition) });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssistantFormFooterComponent],
      providers: [{ provide: FormAssistant, useClass: FakeAssistant }],
    }).compileComponents();
    assistant = TestBed.inject(FormAssistant) as FakeAssistant;
    controller = TestBed.inject(AssistantFormController);
    fixture = TestBed.createComponent(AssistantFormFooterComponent);
    fixture.detectChanges();
  });

  it('sem sugestões da IA (V1) a área dos chips não aparece e o campo usa o placeholder padrão', () => {
    attach(form());

    expect(el().querySelector('.assistant-form-footer__tips')).toBeNull();
    expect(el().querySelector('textarea')?.getAttribute('placeholder')).toContain('Fale ou escreva');
  });

  it('com sugestões mostra um chip tip por sugestão; tocar num chip pede o preenchimento', async () => {
    attach(
      form({ messagePlaceholder: 'Fale ou escreva a notificação', suggestions: ['Avisar Rafael', 'Enviar caso'] }),
    );

    expect(el().querySelectorAll('app-tip').length).toBe(2);
    expect(el().querySelector('textarea')?.getAttribute('placeholder')).toBe('Fale ou escreva a notificação');

    (el().querySelector('app-tip button') as HTMLButtonElement).click();
    await settle();

    expect(assistant.calls).toEqual([{ text: 'Avisar Rafael' }]);
  });

  it('mensagem enviada com sucesso limpa o campo; sem IA avisa e mantém o texto', async () => {
    attach(form());
    const field = fixture.debugElement.query(By.css('app-input-chat')).componentInstance;

    field.value.set('avisar o Jairo');
    fixture.detectChanges();
    field.send.emit('avisar o Jairo');
    await settle();

    expect(field.value()).toBe('');

    assistant.result = null;
    field.value.set('outra');
    fixture.detectChanges();
    field.send.emit('outra');
    await settle();

    expect(field.value()).toBe('outra');
    expect(el().querySelector('.assistant-form-footer__hint')?.textContent).toContain('ainda não está disponível');
  });

  it('áudio gravado vai para a IA e o campo volta ao modo texto', async () => {
    attach(form());
    const field = fixture.debugElement.query(By.css('app-input-chat')).componentInstance;

    field.mode.set('audio');
    fixture.detectChanges();
    field.audioSend.emit(new Blob(['a']));
    await settle();

    expect(assistant.calls.length).toBe(1);
    expect(field.mode()).toBe('text');

    assistant.result = null;
    field.audioSend.emit(new Blob(['b']));
    await settle();

    expect(field.mode()).toBe('text');
  });
});
