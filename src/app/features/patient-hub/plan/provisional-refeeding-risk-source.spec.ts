import { ProvisionalRefeedingRiskSource } from './provisional-refeeding-risk-source';

describe('ProvisionalRefeedingRiskSource', () => {
  const source = new ProvisionalRefeedingRiskSource();

  it('p1: risco em progressão rumo à meta', async () => {
    expect(await source.load('p1')).toEqual({ atRisk: true, targetReached: false });
  });

  it('p2: risco com meta atingida', async () => {
    expect(await source.load('p2')).toEqual({ atRisk: true, targetReached: true });
  });

  it('demais pacientes: sem risco', async () => {
    expect(await source.load('x')).toEqual({ atRisk: false, targetReached: false });
  });
});
