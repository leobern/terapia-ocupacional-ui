import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  AssistantEditorController,
  EDITOR_ASSIST_UNAVAILABLE_HINT,
} from '../../services/assistant-editor-controller.service';
import { InputChatComponent } from '../input-chat/input-chat.component';
import { AssistantEditorFooterComponent } from './assistant-editor-footer.component';

describe('AssistantEditorFooterComponent', () => {
  let fixture: ComponentFixture<AssistantEditorFooterComponent>;
  let run: jasmine.Spy;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    run = jasmine.createSpy('run');
    TestBed.inject(AssistantEditorController).attach({
      actions: signal([
        { id: 'add', label: 'Adicionar novo item' },
        { id: 'save', label: 'Salvar' },
      ]),
      placeholder: 'Escreva a sua mensagem',
      run,
    });
    fixture = TestBed.createComponent(AssistantEditorFooterComponent);
    fixture.detectChanges();
  });

  it('mostra as ações do editor como chips acima do campo de mensagem e as executa', () => {
    const chips = Array.from(root().querySelectorAll('app-tip button'));

    expect(chips.map(c => c.textContent.trim())).toEqual(['Adicionar novo item', 'Salvar']);
    (chips[1] as HTMLButtonElement).click();

    expect(run).toHaveBeenCalledWith('save');
  });

  it('mensagem ou áudio mostra o aviso de que a alteração por IA ainda não está disponível', () => {
    const chat = fixture.debugElement.children
      .flatMap(c => c.children)
      .find(d => d.componentInstance instanceof InputChatComponent)?.componentInstance as InputChatComponent;

    chat.send.emit('mude o peso');
    fixture.detectChanges();

    expect(root().textContent).toContain(EDITOR_ASSIST_UNAVAILABLE_HINT);
  });

  it('sem editor registrado não mostra chips e usa o placeholder padrão', () => {
    TestBed.resetTestingModule();
    fixture = TestBed.createComponent(AssistantEditorFooterComponent);
    fixture.detectChanges();

    expect(root().querySelectorAll('app-tip').length).toBe(0);
    expect(root().querySelector('textarea, input')?.getAttribute('placeholder')).toContain('Escreva a sua mensagem');
  });
});
