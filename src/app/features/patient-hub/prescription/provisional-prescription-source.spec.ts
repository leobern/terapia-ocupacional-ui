import { Prescription } from './prescription.models';
import { ProvisionalPrescriptionSource } from './provisional-prescription-source';

const next: Prescription = {
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
  it('devolve null para paciente sem prescrição', async () => {
    expect(await new ProvisionalPrescriptionSource().load('zz')).toBeNull();
  });

  it('gravar substitui a vigente anterior', async () => {
    const source = new ProvisionalPrescriptionSource();

    expect((await source.load('p1'))?.volumeMl).toBe(900);
    await source.save({ patientId: 'p1', prescription: next });

    expect(await source.load('p1')).toEqual(next);
  });
});
