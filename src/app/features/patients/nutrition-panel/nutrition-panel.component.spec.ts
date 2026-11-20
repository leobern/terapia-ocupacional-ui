import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NutritionPanelComponent } from './nutrition-panel.component';

describe('NutritionPanelComponent', () => {
  let fixture: ComponentFixture<NutritionPanelComponent>;

  const cards = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('.nutrition-panel__card'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NutritionPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(NutritionPanelComponent);
  });

  it('exibe os 8 cards fixos, em ordem, todos "Sem dados" sem nenhum valor', () => {
    fixture.detectChanges();

    expect(cards().map(c => c.querySelector('.nutrition-panel__label')?.textContent?.trim())).toEqual([
      'Peso',
      'IMC',
      'NRS-2002',
      'GLIM',
      'SARC-F',
      'Tipo de terapia nutricional',
      '% adequação calórica',
      '% adequação proteica',
    ]);

    expect(cards().every(c => c.querySelector('.nutrition-panel__value')?.textContent?.trim() === 'Sem dados')).toBe(
      true,
    );
  });

  it('nunca omite um card fixo, mesmo com valores parciais, nulos ou em branco', () => {
    fixture.componentRef.setInput('values', { weight: '51,0 kg', bmi: null, glim: '   ' });
    fixture.detectChanges();

    expect(cards().length).toBe(8);
    const text = cards().map(c => c.querySelector('.nutrition-panel__value')?.textContent?.trim());

    expect(text[0]).toBe('51,0 kg');
    expect(text[1]).toBe('Sem dados');
    expect(text[3]).toBe('Sem dados');
  });

  it('tem título de seção "Diagnóstico" e região acessível', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h2')?.textContent?.trim()).toBe('Diagnóstico');
    expect(fixture.nativeElement.querySelector('section')?.getAttribute('aria-labelledby')).toBeTruthy();
  });
});
