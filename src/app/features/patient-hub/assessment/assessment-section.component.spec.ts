import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NutritionFunctionalAssessment } from './assessment.models';
import { AssessmentSectionComponent, LOAD_FAILED_HINT } from './assessment-section.component';
import { AssessmentSource } from './assessment-source';
import { ProvisionalAssessmentSource } from './provisional-assessment-source';

class FakeSource extends AssessmentSource {
  result: Promise<NutritionFunctionalAssessment | null> = Promise.resolve(null);
  readonly calls: string[] = [];

  loadLatest(patientId: string): Promise<NutritionFunctionalAssessment | null> {
    this.calls.push(patientId);

    return this.result;
  }
}

describe('AssessmentSectionComponent', () => {
  let fixture: ComponentFixture<AssessmentSectionComponent>;
  let source: FakeSource;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dialog = (): HTMLDialogElement => el().querySelector('dialog') as HTMLDialogElement;
  const row = (): HTMLButtonElement => el().querySelector('.assessment__row') as HTMLButtonElement;
  const input = (id: string): HTMLInputElement => el().querySelector(`#assessment-${id}`) as HTMLInputElement;
  const help = (id: string): string => (el().querySelector(`#assessment-help-${id}`) as HTMLElement).textContent.trim();
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const openIt = async (): Promise<void> => {
    row().click();
    await settle();
  };

  beforeEach(async () => {
    source = new FakeSource();
    TestBed.configureTestingModule({ providers: [{ provide: AssessmentSource, useValue: source }] });
    fixture = TestBed.createComponent(AssessmentSectionComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    await settle();
  });

  it('aparece recolhida por padrão, com o modal fechado', () => {
    expect(row().textContent).toContain('Avaliação Nutricional e Funcional');
    expect(dialog().open).toBe(false);
    expect(source.calls).toEqual([]);
  });

  it('abre o modal com as duas sub-seções e todos os campos vazios (sem avaliação anterior)', async () => {
    await openIt();

    expect(dialog().open).toBe(true);
    const titles = Array.from(el().querySelectorAll('.assessment__section-title')).map(t => t.textContent.trim());

    expect(titles).toEqual(['Avaliação nutricional', 'Avaliação funcional']);
    for (const id of ['weight', 'height', 'handgrip', 'dysphagia']) {
      expect(input(id).value).toBe('');
    }

    expect(input('weight').placeholder).toBe('Ex.: 51,0');
    expect(help('height')).toBe('Usada no cálculo do IMC.');
    expect(source.calls).toEqual(['p1']);
  });

  it('mostra o contador de campos de cada sub-seção', async () => {
    await openIt();
    const counts = Array.from(el().querySelectorAll('.assessment__count')).map(c => c.textContent.trim());

    expect(counts).toEqual(['2', '2']);
  });

  it('pré-preenche com a avaliação mais recente e mostra o valor anterior com data', async () => {
    source.result = Promise.resolve({
      previous: { weight: { at: '2026-05-20T12:00:00', value: '50,4' } },
      values: { handgrip: '14', weight: '51,0' },
    });
    await openIt();

    expect(input('weight').value).toBe('51,0');
    expect(input('handgrip').value).toBe('14');
    expect(input('height').value).toBe('');
    expect(input('dysphagia').value).toBe('');
    expect(help('weight')).toBe('Anterior: 50,4 kg em 20/05.');
    expect(help('height')).toBe('Usada no cálculo do IMC.');
  });

  it('mostra o valor anterior sem unidade quando o campo não tem unidade', async () => {
    source.result = Promise.resolve({
      previous: { dysphagia: { at: '2026-05-02T12:00:00', value: 'Baixo' } },
      values: {},
    });
    await openIt();

    expect(help('dysphagia')).toBe('Anterior: Baixo em 02/05.');
  });

  it('mostra carregamento enquanto a leitura não termina', async () => {
    let resolve: (v: NutritionFunctionalAssessment | null) => void = _ => undefined;

    source.result = new Promise(r => (resolve = r));
    row().click();
    fixture.detectChanges();

    expect(el().querySelector('[role="status"]')?.textContent).toContain('Carregando');
    resolve(null);
    await settle();

    expect(el().querySelector('[role="status"]')).toBeNull();
  });

  it('abre vazio com aviso quando a leitura falha', async () => {
    source.result = Promise.reject(new Error('x'));
    await openIt();

    expect(dialog().open).toBe(true);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain(LOAD_FAILED_HINT);
    expect(input('weight').value).toBe('');
  });

  it('ignora resposta de uma abertura já fechada', async () => {
    let resolve: (v: NutritionFunctionalAssessment | null) => void = _ => undefined;

    source.result = new Promise(r => (resolve = r));
    row().click();
    fixture.detectChanges();
    (el().querySelector('app-icon-button button') as HTMLButtonElement).click();
    resolve({ previous: {}, values: { weight: '99' } });
    await settle();

    expect(dialog().open).toBe(false);
    expect(input('weight').value).toBe('');
  });

  it('ignora falha de uma abertura já fechada', async () => {
    let reject: (e: Error) => void = _ => undefined;

    source.result = new Promise((_, r) => (reject = r));
    row().click();
    fixture.detectChanges();
    (el().querySelector('app-icon-button button') as HTMLButtonElement).click();
    reject(new Error('x'));
    await settle();

    expect(el().querySelector('[role="alert"]')).toBeNull();
  });

  it('fechar volta ao Hub com a seção recolhida', async () => {
    await openIt();
    (el().querySelector('app-icon-button button') as HTMLButtonElement).click();
    await settle();

    expect(dialog().open).toBe(false);
    expect(row().getAttribute('aria-expanded')).toBe('false');
  });

  it('fecha pelo scrim e pelo Esc', async () => {
    await openIt();
    dialog().click();
    await settle();

    expect(dialog().open).toBe(false);

    await openIt();
    const cancel = new Event('cancel', { cancelable: true });

    dialog().dispatchEvent(cancel);
    await settle();

    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(false);
  });

  it('clique dentro do conteúdo não fecha', async () => {
    await openIt();
    (el().querySelector('.assessment__title') as HTMLElement).click();
    await settle();

    expect(dialog().open).toBe(true);
  });
});

describe('ProvisionalAssessmentSource', () => {
  it('devolve null para paciente sem avaliação e a avaliação de exemplo para p1', async () => {
    const source = new ProvisionalAssessmentSource();

    expect(await source.loadLatest('p9')).toBeNull();
    expect((await source.loadLatest('p1'))?.values.weight).toBe('51,0');
  });
});
