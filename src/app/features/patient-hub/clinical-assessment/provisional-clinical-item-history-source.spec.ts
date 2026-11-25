import { ProvisionalClinicalItemHistorySource } from './provisional-clinical-item-history-source';

describe('ProvisionalClinicalItemHistorySource', () => {
  const key = 'conductia:clinical-item-history';

  beforeEach(() => localStorage.removeItem(key));

  afterEach(() => localStorage.removeItem(key));

  it('começa vazio e lembra os itens; o mais recente vem primeiro e o título não se repete', async () => {
    const source = new ProvisionalClinicalItemHistorySource();

    expect(await source.load()).toEqual([]);
    await source.remember([{ ranges: [], title: 'Panturrilha', unit: 'cm' }]);
    await source.remember([
      { ranges: [{ from: 0, label: 'Baixo', to: 5, tone: 'alert' }], title: 'Ângulo de fase', unit: 'graus' },
      { ranges: [], title: 'panturrilha', unit: 'cm' },
    ]);
    const history = await source.load();

    expect(history.map(i => i.title)).toEqual(['Ângulo de fase', 'panturrilha']);
  });
});
