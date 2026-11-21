import { TestBed } from '@angular/core/testing';

import { FollowUpClosureSource } from '../follow-up-closure/follow-up-closure-source';
import { ProvisionalFollowUpClosureSource } from '../follow-up-closure/provisional-follow-up-closure';
import { assemblePatientList } from './patient-list-assembly';
import { ProvisionalPatientListSource } from './provisional-patient-list';

describe('ProvisionalPatientListSource', () => {
  let closures: ProvisionalFollowUpClosureSource;
  let source: ProvisionalPatientListSource;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProvisionalFollowUpClosureSource,
        { provide: FollowUpClosureSource, useExisting: ProvisionalFollowUpClosureSource },
        ProvisionalPatientListSource,
      ],
    });
    closures = TestBed.inject(ProvisionalFollowUpClosureSource);
    source = TestBed.inject(ProvisionalPatientListSource);
  });

  it('inclui pacientes do censo geral que a montagem deixa de fora', async () => {
    const census = await source.loadCensus();
    const list = assemblePatientList(census, 'hospital-vila-nova-star', new Date());

    expect(census.length).toBeGreaterThan(list.length);
    expect(list.some(p => p.id.startsWith('x'))).toBe(false);
  });

  it('um encerramento gravado vira a data de efeito do paciente e ele sai da lista a partir dela', async () => {
    const day = new Date(2026, 10, 21);

    await closures.close({
      at: day.toISOString(),
      author: 'Michelle',
      effectiveDate: '2026-11-21',
      patientId: 'p1',
      reason: 'death',
    });
    const census = await source.loadCensus();

    expect(assemblePatientList(census, 'hospital-vila-nova-star', day).some(p => p.id === 'p1')).toBeFalse();
    expect(
      assemblePatientList(census, 'hospital-vila-nova-star', new Date(2026, 10, 20)).some(p => p.id === 'p1'),
    ).toBeTrue();

    expect(census.find(p => p.id === 'p2')?.followUpEndDate).toBeUndefined();
  });
});
