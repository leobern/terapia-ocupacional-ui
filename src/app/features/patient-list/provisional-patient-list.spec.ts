import { assemblePatientList } from './patient-list-assembly';
import { ProvisionalPatientListSource } from './provisional-patient-list';

describe('ProvisionalPatientListSource', () => {
  it('inclui pacientes do censo geral que a montagem deixa de fora', async () => {
    const census = await new ProvisionalPatientListSource().loadCensus();
    const list = assemblePatientList(census, 'hospital-vila-nova-star', new Date());

    expect(census.length).toBeGreaterThan(list.length);
    expect(list.some(p => p.id.startsWith('x'))).toBe(false);
  });
});
