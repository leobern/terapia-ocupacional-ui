import { ProvisionalDiagnosisSource } from './provisional-diagnosis-source';

describe('ProvisionalDiagnosisSource', () => {
  const source = new ProvisionalDiagnosisSource();

  it('gives p1 a positive screening', async () => {
    expect((await source.load('p1')).screeningPositive).toBeTrue();
  });

  it('gives other patients no screening', async () => {
    expect((await source.load('zz')).screeningPositive).toBeFalse();
  });
});
