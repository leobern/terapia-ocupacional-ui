import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NutritionFunctionalAssessment } from '../assessment/assessment.models';
import { AssessmentSource } from '../assessment/assessment-source';
import { NUTRITIONAL_FUNCTIONAL_FIELDS } from './nutritional-functional.models';
import { NutritionalFunctionalTilesComponent } from './nutritional-functional-tiles.component';

class FakeSource extends AssessmentSource {
  loads = 0;
  fails = false;
  latest: NutritionFunctionalAssessment | null = {
    previous: {},
    values: { calfCircumference: '31', calfSide: 'Direito', handgrip: '14' },
  };

  loadLatest(): Promise<NutritionFunctionalAssessment | null> {
    this.loads++;

    return this.fails ? Promise.reject(new Error('x')) : Promise.resolve(this.latest);
  }
}

describe('NutritionalFunctionalTilesComponent', () => {
  let fixture: ComponentFixture<NutritionalFunctionalTilesComponent>;
  let source: FakeSource;
  const text = (): string => (fixture.nativeElement as HTMLElement).textContent.replace(/\s+/gu, ' ');
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    source = new FakeSource();
    TestBed.configureTestingModule({ providers: [{ provide: AssessmentSource, useValue: source }] });
    fixture = TestBed.createComponent(NutritionalFunctionalTilesComponent);
    fixture.componentRef.setInput('patientId', 'p1');
  });

  it('não traz peso nem altura: só os itens fixos', () => {
    const ids = NUTRITIONAL_FUNCTIONAL_FIELDS.map(f => f.id);

    expect(ids).toEqual(['calfCircumference', 'armCircumference', 'indirectCalorimetry', 'handgrip', 'dysphagia']);
  });

  it('mostra o último valor com a unidade e o membro; sem dado, "Sem dados"', async () => {
    await settle();
    const tiles = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="nutritional-tile"]');

    expect(tiles.length).toBe(5);
    expect(text()).toContain('Circunferência da panturrilha31 cm · Direito');
    expect(text()).toContain('Handgrip14 kgf');
    expect(text()).toContain('Risco de disfagiaSem dados');
  });

  it('sem avaliação anterior, todos ficam "Sem dados"', async () => {
    source.latest = null;
    await settle();

    expect(text().match(/Sem dados/gu)?.length).toBe(5);
  });

  it('lê de novo quando a chave de atualização muda', async () => {
    await settle();
    fixture.componentRef.setInput('refreshKey', 1);
    await settle();

    expect(source.loads).toBe(2);
  });

  it('falha na leitura não quebra', async () => {
    source.fails = true;
    await settle();

    expect(text()).toContain('Sem dados');
  });
});
