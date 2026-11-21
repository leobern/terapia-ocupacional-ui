import { TestBed } from '@angular/core/testing';

import { ProfessionalProfile, ProfessionalProfileReader } from '../../home/professional-profile';
import { Prescription } from './prescription.models';
import { ProvisionalPrescriptionSource } from './provisional-prescription-source';

const next: Prescription = {
  route: 'NE',
  at: '2026-11-21T10:00:00Z',
  author: 'Dra. Ana',
  formulaId: 'x',
  formulaName: 'X',
  kcalPerMl: 1,
  modality: 'continuous',
  nursingNotes: '',
  pauseTimes: [],
  proteinPerMl: 0.04,
  startTime: '08:00',
  volumeMl: 500,
};

describe('ProvisionalPrescriptionSource', () => {
  const make = (role: ProfessionalProfile['role']): ProvisionalPrescriptionSource => {
    TestBed.configureTestingModule({
      providers: [
        ProvisionalPrescriptionSource,
        { provide: ProfessionalProfileReader, useValue: { read: (): ProfessionalProfile => ({ name: 'Ana', role }) } },
      ],
    });

    return TestBed.inject(ProvisionalPrescriptionSource);
  };

  it('devolve null para paciente sem prescrição ou revisão', async () => {
    const source = make('doctor');

    expect(await source.load('zz')).toEqual([]);
    expect(await source.loadActive('zz')).toEqual([]);
    expect(await source.loadReview('p1', '2026-11-21')).toBeNull();
  });

  it('gravar substitui a vigente anterior e o resumo da revisão acompanha', async () => {
    const source = make('doctor');

    expect((await source.load('p1'))[0]?.volumeMl).toBe(900);
    expect((await source.loadActive('p1'))[0]?.volumeMlPerDay).toBe(900);
    await source.save({ patientId: 'p1', prescriptions: [next] });

    expect(await source.load('p1')).toEqual([next]);
    expect((await source.loadActive('p1'))[0]).toEqual(
      jasmine.objectContaining({ formula: 'X', kcal: 500, proteinG: 20, volumeMlPerDay: 500 }),
    );
  });

  it('médico registra a revisão do dia', async () => {
    const source = make('doctor');
    const request = { at: '2026-11-21T10:00:00Z', author: 'Ana', day: '2026-11-21', patientId: 'p1' };

    expect(await source.keep(request)).toEqual({ at: request.at, author: 'Ana', day: request.day });
    expect((await source.loadReview('p1', '2026-11-21'))?.author).toBe('Ana');
  });

  it('recusa quem não é médico', async () => {
    const source = make('other');

    await expectAsync(
      source.keep({ at: '2026-11-21T10:00:00Z', author: 'Bia', day: '2026-11-21', patientId: 'p1' }),
    ).toBeRejected();

    expect(await source.loadReview('p1', '2026-11-21')).toBeNull();
  });
});
