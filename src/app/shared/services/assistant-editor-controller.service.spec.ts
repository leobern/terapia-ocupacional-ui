import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  AssistantEditorController,
  EDITOR_ASSIST_UNAVAILABLE_HINT,
  type EditorAction,
} from './assistant-editor-controller.service';

describe('AssistantEditorController', () => {
  let controller: AssistantEditorController;
  const actions = signal<readonly EditorAction[]>([{ id: 'save', label: 'Salvar' }]);

  beforeEach(() => {
    controller = TestBed.inject(AssistantEditorController);
  });

  it('registra o editor, executa a ação pedida e se remove', () => {
    const run = jasmine.createSpy('run');
    const detach = controller.attach({ actions, placeholder: 'Mensagem', run });

    controller.run('save');

    expect(run).toHaveBeenCalledWith('save');
    expect(controller.active()?.placeholder).toBe('Mensagem');
    detach();

    expect(controller.active()).toBeNull();
  });

  it('só se remove se ainda for o editor atual', () => {
    const first = controller.attach({ actions, placeholder: 'A', run: (): void => undefined });
    const second = controller.attach({ actions, placeholder: 'B', run: (): void => undefined });

    first();

    expect(controller.active()?.placeholder).toBe('B');
    second();
  });

  it('mensagem ou áudio avisa que a alteração por IA ainda não existe; rodar uma ação limpa o aviso', () => {
    const detach = controller.attach({ actions, placeholder: 'M', run: (): void => undefined });

    controller.message();

    expect(controller.hint()).toBe(EDITOR_ASSIST_UNAVAILABLE_HINT);
    controller.run('save');

    expect(controller.hint()).toBeNull();
    detach();
  });

  it('rodar uma ação sem editor aberto não faz nada', () => {
    expect(() => controller.run('save')).not.toThrow();
  });
});
