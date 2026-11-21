import { ProvisionalDailyRecordSource } from './provisional-daily-record-source';

describe('ProvisionalDailyRecordSource', () => {
  const entry = { at: '2026-05-28T08:10:00', author: 'Michelle', parameterId: 'glycemia', value: 118 };

  it('começa vazio e guarda os lançamentos por paciente, com id próprio', async () => {
    const source = new ProvisionalDailyRecordSource();

    expect(await source.loadEntries('p1')).toEqual([]);
    const [created] = await source.record('p1', [entry]);

    expect(created).toEqual({ ...entry, id: jasmine.any(String) });
    expect(await source.loadEntries('p1')).toEqual([created]);
    expect(await source.loadEntries('p2')).toEqual([]);
  });

  it('um novo lançamento do mesmo parâmetro é acrescentado sem sobrescrever o anterior', async () => {
    const source = new ProvisionalDailyRecordSource();

    await source.record('p1', [entry]);
    await source.record('p1', [{ ...entry, value: 132 }]);
    const all = await source.loadEntries('p1');

    expect(all.map(e => e.value)).toEqual([118, 132]);
    expect(new Set(all.map(e => e.id)).size).toBe(2);
  });
});
