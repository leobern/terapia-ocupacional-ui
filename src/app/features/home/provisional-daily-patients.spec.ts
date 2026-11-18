import { ProvisionalDailyPatientsSource } from './provisional-daily-patients';

describe('ProvisionalDailyPatientsSource', () => {
  it('devolve valores de exemplo para o card de contagem e a meta nutricional', async () => {
    expect(await new ProvisionalDailyPatientsSource().loadForDay()).toEqual({
      averageCaloricPercentage: 82,
      averageProteinPercentage: 64,
      patientCount: 12,
    });
  });
});
