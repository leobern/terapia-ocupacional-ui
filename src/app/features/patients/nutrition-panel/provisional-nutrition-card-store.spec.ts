import { ProvisionalNutritionCardStore } from './provisional-nutrition-card-store';

describe('ProvisionalNutritionCardStore — visibilidade (US6)', () => {
  it('oculta e reexibe por paciente, sem tocar no valor nem no histórico', async () => {
    const store = new ProvisionalNutritionCardStore();

    await store.save({
      at: '2026-05-28T12:00:00Z',
      author: 'Michelle',
      indicator: 'weight',
      newOrigin: 'manual',
      patientId: 'p1',
      previous: { at: null, origin: 'result', value: '50' },
      value: '51',
    });
    await store.setHidden('p1', 'weight', true);
    await store.setHidden('p1', 'weight', true);

    expect(await store.loadHidden('p1')).toEqual(['weight']);
    expect(await store.loadHidden('p2')).toEqual([]);
    expect((await store.load('p1', 'weight')).length).toBe(1);
    expect((await store.loadManual('p1')).weight?.value).toBe('51');

    await store.setHidden('p1', 'weight', false);

    expect(await store.loadHidden('p1')).toEqual([]);
  });
});
