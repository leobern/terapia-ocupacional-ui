import { ProvisionalNutritionResultsSource } from './provisional-nutrition-results';

describe('ProvisionalNutritionResultsSource', () => {
  const source = new ProvisionalNutritionResultsSource();

  it('devolve resultados de exemplo para o p1', async () => {
    expect((await source.load('p1'))['nrs-2002']).toBeTruthy();
  });

  it('devolve vazio para os demais pacientes', async () => {
    expect(await source.load('p2')).toEqual({});
  });
});
