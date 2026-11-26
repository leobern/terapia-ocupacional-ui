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

  it('list: só os dias com evolução, do mais recente ao mais antigo; tolera falha de um dia', async () => {
    const source = new ProvisionalDailyEvolutionSource();
    const base = { author: 'Dr. A', at: '2026-11-20T10:00:00', origin: 'manual', patientId: 'p1' } as const;

    await source.save({ ...base, day: '2026-11-18', text: 'a' });
    await source.save({ ...base, day: '2026-11-20', text: 'b' });

    expect((await source.list('p1', ['2026-11-20', '2026-11-19', '2026-11-18'])).map(d => d.day)).toEqual([
      '2026-11-20',
      '2026-11-18',
    ]);

    expect(await source.list('p1', [])).toEqual([]);

    const original = source.load.bind(source);

    spyOn(source, 'load').and.callFake((id, day) =>
      day === '2026-11-19' ? Promise.reject(new Error('x')) : original(id, day),
    );

    expect((await source.list('p1', ['2026-11-20', '2026-11-19'])).length).toBe(1);
  });

  it('list: rejeita quando todas as leituras falham', async () => {
    const source = new ProvisionalDailyEvolutionSource();

    spyOn(source, 'load').and.rejectWith(new Error('x'));
    await expectAsync(source.list('p1', ['2026-11-20'])).toBeRejected();
  });
});
