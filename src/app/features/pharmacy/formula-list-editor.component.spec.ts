import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssistantEditorController } from '../../shared/services/assistant-editor-controller.service';
import { FormulaListEditorComponent } from './formula-list-editor.component';
import { Formula } from './formulas.models';

const formula = (id: string, name: string, standardized = false): Formula => ({
  category: 'enteral',
  fiber: null,
  gluten: null,
  id,
  kcalPerMl: 1,
  lactose: null,
  manufacturer: null,
  name,
  packaging: null,
  presentation: null,
  proteinPerMl: null,
  route: null,
  standardized,
  sucrose: null,
  unit: 'ml',
});

describe('FormulaListEditorComponent', () => {
  let fixture: ComponentFixture<FormulaListEditorComponent>;
  let standardize: jasmine.Spy<(ids: readonly string[]) => Promise<readonly string[]>>;
  let request: jasmine.Spy<(description: string) => Promise<void>>;

  const catalog = signal<readonly Formula[]>([]);
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => root().textContent;
  const checks = (): HTMLInputElement[] => Array.from(root().querySelectorAll('input[type=checkbox]'));
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent.includes(label));
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const create = async (initialText: string): Promise<void> => {
    fixture = TestBed.createComponent(FormulaListEditorComponent);
    fixture.componentRef.setInput('formulas', catalog.asReadonly());
    fixture.componentRef.setInput('standardize', standardize);
    fixture.componentRef.setInput('request', request);
    fixture.componentRef.setInput('initialText', initialText);
    fixture.detectChanges();
    await settle();
  };

  beforeEach(() => {
    standardize = jasmine.createSpy('standardize').and.resolveTo([]);
    request = jasmine.createSpy('request').and.resolveTo();
    catalog.set([formula('1', 'Diben'), formula('2', 'Fresubin Energy'), formula('3', 'Fresubin Original', true)]);
  });

  it('marca sozinho só o que não deixa dúvida e padroniza os marcados de uma vez', async () => {
    await create('Diben\nFresubin');

    expect(checks().map(c => [c.checked, c.disabled])).toEqual([
      [true, false],
      [false, false],
      [true, true],
    ]);

    expect(text()).toContain('já padronizada');

    checks()[1].click();
    fixture.detectChanges();
    button('Padronizar 2 selecionada(s)')?.click();
    await settle();

    expect(standardize).toHaveBeenCalledWith(['1', '2']);
    expect(text()).toContain('2 fórmula(s) padronizada(s)');
  });

  it('desmarcar tira da seleção e falha ao salvar mostra o nome', async () => {
    standardize.and.resolveTo(['Fresubin Energy']);
    await create('Diben, Fresubin Energy');

    checks()[0].click();
    fixture.detectChanges();
    button('Padronizar 1 selecionada(s)')?.click();
    await settle();

    expect(standardize).toHaveBeenCalledWith(['2']);
    expect(text()).toContain('Não foi possível salvar: Fresubin Energy');
  });

  it('o que não existe vira um pedido de inclusão', async () => {
    await create('Peptamen\nNutren');

    expect(text()).toContain('Não encontrada no catálogo.');
    button('Pedir inclusão')?.click();
    await settle();

    expect(request).toHaveBeenCalledWith('Fórmulas não encontradas no catálogo: Peptamen; Nutren');
    expect(text()).toContain('Pedido de inclusão enviado');
    expect(button('Pedir inclusão')).toBeUndefined();
  });

  it('falha no envio do pedido avisa e mantém o botão', async () => {
    request.and.rejectWith(new Error('offline'));
    await create('Peptamen');

    button('Pedir inclusão')?.click();
    await settle();

    expect(text()).toContain('Não foi possível enviar o pedido');
    expect(button('Pedir inclusão')).toBeDefined();
  });

  it('sem texto não busca; digitando no campo, o botão busca', async () => {
    await create('');

    expect(button('Buscar no catálogo')?.disabled).toBeTrue();

    const area = root().querySelector('textarea') as HTMLTextAreaElement;

    area.value = 'Diben';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('Buscar no catálogo')?.click();
    fixture.detectChanges();

    expect(checks().length).toBe(1);
  });

  it('recebe os nomes pelo campo de mensagem do rodapé', async () => {
    await create('');

    expect(TestBed.inject(AssistantEditorController).message('Diben')).toBeTrue();
    fixture.detectChanges();

    expect(checks().length).toBe(1);
    fixture.destroy();

    expect(TestBed.inject(AssistantEditorController).active()).toBeNull();
  });
});
