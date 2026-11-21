import { ProvisionalFollowUpClosureSource } from './provisional-follow-up-closure';

describe('ProvisionalFollowUpClosureSource', () => {
  const request = (patientId: string, effectiveDate: string) => ({
    at: '2026-11-21T10:00:00.000Z',
    author: 'Michelle',
    effectiveDate,
    patientId,
    reason: 'hospital-discharge' as const,
  });

  it('grava só acrescentando: encerramentos sucessivos mantêm todo o histórico', async () => {
    const source = new ProvisionalFollowUpClosureSource();
    const first = await source.close(request('p1', '2026-11-10'));
    const second = await source.close(request('p1', '2026-11-20'));
    await source.close(request('p2', '2026-11-20'));

    expect(first.id).not.toBe(second.id);
    expect((await source.list('p1')).map(c => c.effectiveDate)).toEqual(['2026-11-10', '2026-11-20']);
    expect(await source.listAll()).toHaveSize(3);
    expect(await source.list('p9')).toEqual([]);
  });
});
