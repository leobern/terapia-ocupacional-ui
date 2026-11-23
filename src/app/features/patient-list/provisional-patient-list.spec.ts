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
    const census = await source.loadCensus(1);
    const list = assemblePatientList(census, 1, new Date());

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
    const census = await source.loadCensus(1);

    expect(assemblePatientList(census, 1, day).some(p => p.id === 'p1')).toBeFalse();
    expect(assemblePatientList(census, 1, new Date(2026, 10, 20)).some(p => p.id === 'p1')).toBeTrue();

    expect(census.find(p => p.id === 'p2')?.followUpEndDate).toBeUndefined();
  });

  it('reabrir revoga a data de efeito: o paciente volta à lista, e o encerramento segue no histórico', async () => {
    const day = new Date(2026, 10, 21);
    const closure = await closures.close({
      at: day.toISOString(),
      author: 'Michelle',
      effectiveDate: '2026-11-21',
      patientId: 'p1',
      reason: 'death',
    });

    await closures.reopen({ at: day.toISOString(), author: 'Bia', closureId: closure.id, patientId: 'p1' });
    const census = await source.loadCensus(1);

    expect(census.find(p => p.id === 'p1')?.followUpEndDate).toBeUndefined();
    expect(assemblePatientList(census, 1, day).some(p => p.id === 'p1')).toBeTrue();
    expect(await closures.list('p1')).toHaveSize(1);
  });
});
