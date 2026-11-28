import { matchFormulas, splitFormulaNames } from './formula-matcher';
import { Formula } from './formulas.models';

const formula = (id: string, name: string, manufacturer: string | null = null): Formula => ({
  category: 'enteral',
  fiber: null,
  gluten: null,
  id,
  kcalPerMl: 1,
  lactose: null,
  manufacturer,
  name,
  packaging: null,
  presentation: null,
  proteinPerMl: null,
  route: null,
  standardized: false,
  sucrose: null,
  unit: 'ml',
});

describe('formula-matcher', () => {
  const catalog = [
    formula('1', 'Diben®', 'Fresenius Kabi'),
    formula('2', 'Diben® 1.5 kcal HP', 'Fresenius Kabi'),
    formula('3', 'Fresubin® Original', 'Fresenius Kabi'),
    formula('4', 'Nutrição Enteral 1.0'),
  ];
  const ids = (text: string): string[][] => matchFormulas(text, catalog).map(m => m.candidates.map(c => c.id));

  it('separa por linha, ponto e vírgula e vírgula, sem quebrar o decimal nem repetir', () => {
    expect(splitFormulaNames('Diben 1,5\nFresubin, Diben 1,5; ;Nutren')).toEqual(['Diben 1,5', 'Fresubin', 'Nutren']);
  });

  it('nome idêntico (sem ®, acento ou maiúscula) devolve só ele', () => {
    expect(ids('diben')).toEqual([['1']]);
    expect(ids('nutricao enteral 1,0')).toEqual([['4']]);
  });

  it('nome parcial devolve as opções, e ignora as palavras do pedido', () => {
    expect(ids('padronizar a fórmula Dib 1,5')).toEqual([['2']]);
    expect(ids('Fresenius')).toEqual([['1', '2', '3']]);
  });

  it('número não casa pela metade e o que não existe vem sem opções', () => {
    expect(ids('Diben 1')).toEqual([[]]);
    expect(ids('Peptamen')).toEqual([[]]);
  });
});
