import { ProvisionalDailyEvolutionSource } from './provisional-daily-evolution-source';

describe('ProvisionalDailyEvolutionSource', () => {
  it('devolve null sem evolução e a última gravada por paciente e dia', async () => {
    const source = new ProvisionalDailyEvolutionSource();
    const base = {
      author: 'Dr. A',
      at: '2026-11-20T10:00:00',
      origin: 'manual',
      patientId: 'p1',
      day: '2026-11-20',
    } as const;

    expect(await source.load('p1', '2026-11-20')).toBeNull();
    await source.save({ ...base, text: 'primeira' });
    await source.save({ ...base, text: 'segunda' });

    expect((await source.load('p1', '2026-11-20'))?.text).toBe('segunda');
    expect(await source.load('p1', '2026-11-21')).toBeNull();
    expect(await source.load('p2', '2026-11-20')).toBeNull();
  });
});
