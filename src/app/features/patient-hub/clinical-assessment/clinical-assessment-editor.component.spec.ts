import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import { AssistantEditorController } from '../../../shared/services/assistant-editor-controller.service';
import { ClinicalAssessment, ClinicalItemTemplate } from './clinical-assessment.models';
import { ClinicalAssessmentEditorComponent } from './clinical-assessment-editor.component';
import { ClinicalAssessmentSource } from './clinical-assessment-source';
import { ClinicalItemHistorySource } from './clinical-item-history-source';

class FakeSource extends ClinicalAssessmentSource {
  assessment: ClinicalAssessment = {
    device: 'SNE',
    heightCm: 153,
    items: [
      {
        id: 'nrs',
        ranges: [{ from: 3, label: 'Em risco', to: 7, tone: 'warning' }],
        title: 'NRS-2002',
        unit: 'pontos',
        value: '4',
      },
      { id: 'sarcf', ranges: [], title: 'SARC-F', unit: 'pontos', value: '4' },
      { id: 'gli', ranges: [], title: 'Glicemia', unit: 'mg/dL', value: '183' },
    ],
    previousWeight: { at: '20/05', kg: 50.4 },
    tnType: 'NE',
    weightKg: 51,
  };
  loadFails = false;
  saveFails = false;
  readonly saves: ClinicalAssessment[] = [];

  load(): Promise<ClinicalAssessment> {
    return this.loadFails ? Promise.reject(new Error('x')) : Promise.resolve(this.assessment);
  }

  save(_: string, assessment: ClinicalAssessment): Promise<void> {
    if (this.saveFails) {
      return Promise.reject(new Error('x'));
    }
    this.saves.push(assessment);

    return Promise.resolve();
  }
}

class FakeHistory extends ClinicalItemHistorySource {
  items: readonly ClinicalItemTemplate[] = [];
  remembered: readonly ClinicalItemTemplate[] = [];
  rememberFails = false;

  load(): Promise<readonly ClinicalItemTemplate[]> {
    return Promise.resolve(this.items);
  }

  remember(items: readonly ClinicalItemTemplate[]): Promise<void> {
    if (this.rememberFails) {
      return Promise.reject(new Error('x'));
    }
    this.remembered = items;

    return Promise.resolve();
  }
}

describe('ClinicalAssessmentEditorComponent', () => {
  let fixture: ComponentFixture<ClinicalAssessmentEditorComponent>;
  let source: FakeSource;
  let history: FakeHistory;
  let saved: jasmine.Spy;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => root().textContent.replace(/\s+/gu, ' ');
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const cards = (): HTMLElement[] => Array.from(root().querySelectorAll<HTMLElement>('[data-testid="clinical-item"]'));
  const type = async (el: HTMLInputElement, value: string): Promise<void> => {
    el.value = value;
    el.dispatchEvent(new Event('input'));
    await settle();
  };
  const run = async (id: string): Promise<void> => {
    TestBed.inject(AssistantEditorController).run(id);
    await settle();
  };
  const confirmButtons = (): HTMLButtonElement[] =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('.confirm-dialog__actions button'));
  const click = async (el: Element | null | undefined): Promise<void> => {
    (el as HTMLElement | null | undefined)?.click();
    await settle();
  };

  beforeEach(async () => {
    source = new FakeSource();
    history = new FakeHistory();
    saved = jasmine.createSpy('saved');
    TestBed.configureTestingModule({
      providers: [
        { provide: ClinicalAssessmentSource, useValue: source },
        { provide: ClinicalItemHistorySource, useValue: history },
      ],
    });
    fixture = TestBed.createComponent(ClinicalAssessmentEditorComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentRef.setInput('saved', saved);
    await settle();
  });

  it('mostra os 4 campos obrigatórios e os itens livres, com status e o peso anterior', () => {
    expect(text()).toContain('Tipo de TN');
    expect(text()).toContain('Dispositivo');
    expect(text()).toContain('Peso');
    expect(text()).toContain('Altura');
    expect(text()).toContain('Anterior: 50.4 kg em 20/05.');
    expect(text()).toContain('IMC');
    // NRS-2002, GLIM e SARC-F (fixos) + Glicemia
    expect(cards().length).toBe(4);
    expect(text()).toContain('Em risco');
    expect(root().querySelector<HTMLInputElement>('#clin-tn')?.value).toBe('NE');
  });

  it('falha ao carregar informa em texto', async () => {
    source.loadFails = true;
    fixture = TestBed.createComponent(ClinicalAssessmentEditorComponent);
    fixture.componentRef.setInput('patientId', 'p2');
    await settle();

    expect(text()).toContain('Não foi possível carregar a avaliação clínica');
  });

  it('os obrigatórios e os protocolos fixos não têm botão de excluir; os itens livres têm', () => {
    expect(root().querySelectorAll('[aria-label^="Excluir"]').length).toBe(1);
    expect(root().querySelector('[aria-label="Excluir Glicemia"]')).not.toBeNull();
    expect(root().querySelector('[aria-label="Excluir GLIM"]')).toBeNull();
    expect(root().querySelector('[aria-label="Excluir NRS-2002"]')).toBeNull();
    expect(root().querySelector('[aria-label="Excluir SARC-F"]')).toBeNull();
  });

  it('salvar com obrigatório vazio mostra o erro e não grava', async () => {
    await type(root().querySelector<HTMLInputElement>('#clin-weight') as HTMLInputElement, '');
    await type(root().querySelector<HTMLInputElement>('#clin-tn') as HTMLInputElement, '');
    await run('save');

    expect(source.saves.length).toBe(0);
    expect(text()).toContain('Informe o peso.');
    expect(text()).toContain('Informe o tipo de TN.');
  });

  it('salvar grava, avisa a tela e fecha o painel', async () => {
    const assistant = TestBed.inject(AiAssistantService);

    spyOn(assistant, 'closePanel');
    await type(root().querySelector<HTMLInputElement>('#clin-weight') as HTMLInputElement, '52,5');
    await type(root().querySelector<HTMLInputElement>('#clin-tn') as HTMLInputElement, 'np');
    await run('save');

    expect(source.saves[0].weightKg).toBe(52.5);
    expect(source.saves[0].tnType).toBe('NP');
    expect(source.saves[0].items.map(i => i.id)).toEqual(['nrs', 'fixed-glim', 'sarcf', 'gli']);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(assistant.closePanel).toHaveBeenCalledWith();
  });

  it('falha ao gravar mantém os dados e avisa', async () => {
    source.saveFails = true;
    const assistant = TestBed.inject(AiAssistantService);

    spyOn(assistant, 'closePanel');

    await run('save');

    expect(text()).toContain('Não foi possível salvar');
    expect(assistant.closePanel).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
  });

  it('excluir pede confirmação: "Não" mantém, "Sim" remove', async () => {
    await click(root().querySelector('[aria-label="Excluir Glicemia"]'));

    expect(document.querySelector('.confirm-dialog__panel')?.textContent).toContain('Excluir Glicemia?');
    expect(confirmButtons().map(b => b.textContent.trim())).toEqual(['Sim', 'Não']);

    await click(confirmButtons()[1]);

    expect(cards().length).toBe(4);

    await click(root().querySelector('[aria-label="Excluir Glicemia"]'));
    await click(confirmButtons()[0]);

    expect(cards().length).toBe(3);
    expect(text()).not.toContain('Glicemia');
  });

  it('"Adicionar novo item": título, valor, unidade e faixas com cor; o ✓ vira o card de visualização', async () => {
    await run('add');
    const card = cards().at(-1) as HTMLElement;

    expect(card.dataset['editing']).toBe('true');
    await type(card.querySelector('[aria-label="Título do item"]') as HTMLInputElement, 'Panturrilha');
    await type(card.querySelector('input[placeholder="Valor"]') as HTMLInputElement, '31');
    await type(card.querySelector('[aria-label="Unidade"]') as HTMLInputElement, 'cm');
    await click(card.querySelector('.clin__link'));
    await click(card.querySelector('.clin__link'));
    const ranges = Array.from(card.querySelectorAll<HTMLElement>('[data-testid="clinical-range"]'));

    expect(ranges[0].textContent).toContain('Vermelho');
    await type(ranges[0].querySelector('[aria-label="Valor inicial da faixa"]') as HTMLInputElement, '0');
    await type(ranges[0].querySelector('[aria-label="Valor final da faixa"]') as HTMLInputElement, '40');
    await type(ranges[0].querySelector('[aria-label="Nome do status"]') as HTMLInputElement, 'Abaixo');
    // seletor de cor: abre no ponto, escolhe "Azul" e fecha
    await click(ranges[0].querySelector('[aria-label="Escolher a cor do status"]'));

    expect(root().querySelectorAll('[data-testid="clinical-tone"]').length).toBe(7);

    await click(ranges[0].querySelector('[aria-label="Escolher a cor do status"]'));

    expect(root().querySelectorAll('[data-testid="clinical-tone"]').length).toBe(0);

    await click(ranges[0].querySelector('[aria-label="Escolher a cor do status"]'));
    const azul = Array.from(root().querySelectorAll<HTMLElement>('[data-testid="clinical-tone"]')).find(
      t => t.textContent.trim() === 'Azul',
    );

    await click(azul);

    expect(root().querySelectorAll('[data-testid="clinical-tone"]').length).toBe(0);
    expect(ranges[0].textContent).toContain('Azul');
    // a segunda faixa fica incompleta (sem nome): remove-se com a lixeira da faixa
    await type(ranges[1].querySelector('[aria-label="Valor inicial da faixa"]') as HTMLInputElement, '11');
    await click(ranges[1].querySelector('[aria-label="Escolher a cor do status"]'));
    await click(ranges[1].querySelector('[aria-label="Remover faixa"]'));

    expect(card.querySelectorAll('[data-testid="clinical-range"]').length).toBe(1);
    expect(root().querySelectorAll('[data-testid="clinical-tone"]').length).toBe(0);

    await click(card.querySelector('[aria-label="Confirmar o item"]'));

    expect(cards().at(-1)?.dataset['editing']).toBeUndefined();
    expect(cards().at(-1)?.textContent).toContain('Panturrilha');
    expect(cards().at(-1)?.textContent).toContain('Abaixo');

    await run('save');
    const created = source.saves[0].items.at(-1);

    expect(created?.title).toBe('Panturrilha');
    expect(created?.unit).toBe('cm');
    expect(created?.ranges).toEqual([{ from: 0, label: 'Abaixo', to: 40, tone: 'secondary' }]);
  });

  it('o ✓ sem título ou valor mostra o erro no card e não confirma', async () => {
    await run('add');
    const card = cards().at(-1) as HTMLElement;

    await click(card.querySelector('[aria-label="Confirmar o item"]'));

    expect(card.dataset['editing']).toBe('true');
    expect(text()).toContain('Informe o título.');

    await type(card.querySelector('[aria-label="Título do item"]') as HTMLInputElement, 'Glicemia capilar');
    await click(card.querySelector('[aria-label="Confirmar o item"]'));

    expect(text()).toContain('Informe o valor.');
  });

  it('o X do card de cadastro pergunta se quer remover: "Não" mantém, "Sim" remove', async () => {
    await run('add');
    const card = cards().at(-1) as HTMLElement;

    await click(card.querySelector('[aria-label="Cancelar o item"]'));

    expect(document.querySelector('.confirm-dialog__panel')?.textContent).toContain('Remover este item?');

    await click(confirmButtons()[1]);

    expect(cards().length).toBe(5);

    await click(card.querySelector('[aria-label="Cancelar o item"]'));
    await click(confirmButtons()[0]);

    expect(cards().length).toBe(4);
  });

  it('item novo sem título ou valor bloqueia o salvamento com o erro no card', async () => {
    await run('add');
    await type(cards().at(-1)?.querySelector('input[placeholder="Valor"]') as HTMLInputElement, '5');
    await run('save');

    expect(source.saves.length).toBe(0);
    expect(text()).toContain('Informe o título.');

    await type(cards().at(-1)?.querySelector('[aria-label="Título do item"]') as HTMLInputElement, 'Glicemia');
    await type(cards().at(-1)?.querySelector('input[placeholder="Valor"]') as HTMLInputElement, '');
    await run('save');

    expect(text()).toContain('Informe o valor.');
  });

  it('o valor de um item salvo é editável', async () => {
    await type(cards()[0].querySelector('[aria-label="Valor de NRS-2002"]') as HTMLInputElement, '2');
    await run('save');

    expect(source.saves[0].items[0].value).toBe('2');
    expect(source.saves[0].items[0].fixed).toBeTrue();
    expect(source.saves[0].items[0].ranges.length).toBe(1);
  });

  it('GLIM, sem dado ainda, aparece como protocolo fixo vazio', () => {
    const glim = cards().find(c => c.textContent.includes('GLIM')) as HTMLElement;

    expect((glim.querySelector('input') as HTMLInputElement).value).toBe('');
    expect(glim.querySelector('[aria-label^="Excluir"]')).toBeNull();
  });

  it('sugere o histórico do usuário e os tipos padrão que ainda não estão na avaliação; escolher traz título, unidade e faixas', async () => {
    history.items = [
      { ranges: [{ from: 0, label: 'Baixo', to: 5, tone: 'alert' }], title: 'Ângulo de fase', unit: 'graus' },
    ];
    fixture = TestBed.createComponent(ClinicalAssessmentEditorComponent);
    fixture.componentRef.setInput('patientId', 'p3');
    await settle();
    const chips = Array.from(root().querySelectorAll<HTMLButtonElement>('[data-testid="clinical-suggestion"]'));
    const titles = chips.map(c => c.textContent.trim());

    expect(titles[0]).toBe('Ângulo de fase');
    expect(titles).toContain('Handgrip');
    expect(titles).not.toContain('GLIM');
    expect(titles).not.toContain('SARC-F');
    expect(titles).not.toContain('NRS-2002');

    await click(chips[0]);
    const card = cards().at(-1) as HTMLElement;

    expect((card.querySelector('[aria-label="Título do item"]') as HTMLInputElement).value).toBe('Ângulo de fase');
    expect((card.querySelector('[aria-label="Unidade"]') as HTMLInputElement).value).toBe('graus');
    expect(card.querySelectorAll('[data-testid="clinical-range"]').length).toBe(1);
    expect(root().textContent).not.toContain('Sugestões para adicionar Ângulo de fase');
  });

  it('ao salvar, lembra os itens no histórico (mesmo que lembrar falhe, salva)', async () => {
    await run('save');

    expect(history.remembered.map(i => i.title)).toEqual(['NRS-2002', 'GLIM', 'SARC-F', 'Glicemia']);

    history.rememberFails = true;
    await run('save');

    expect(source.saves.length).toBe(2);
  });

  it('o editor se registra no rodapé com as ações e se remove ao ser destruído', () => {
    const controller = TestBed.inject(AssistantEditorController);

    expect(
      controller
        .active()
        ?.actions()
        .map(a => a.id),
    ).toEqual(['add', 'save']);
    fixture.destroy();

    expect(controller.active()).toBeNull();
  });
});
