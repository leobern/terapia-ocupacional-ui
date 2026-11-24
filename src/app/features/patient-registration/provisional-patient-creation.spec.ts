import { ProvisionalPatientCreation } from './provisional-patient-creation';

describe('ProvisionalPatientCreation', () => {
  it('returns a created patient in the requested hospital, without persisting anything', async () => {
    const source = new ProvisionalPatientCreation();
    const first = await source.create({ birthDate: '1975-09-15', fullName: 'Ana', hospitalId: 7, sex: 'FEMALE' });
    const second = await source.create({
      birthDate: '1975-09-15',
      fullName: 'Bia',
      hospitalId: 7,
      medicalRecordNumber: '99',
      sex: 'FEMALE',
    });

    expect(first).toEqual(jasmine.objectContaining({ hospitalId: 7, id: 1, medicalRecordNumber: null }));
    expect(second).toEqual(jasmine.objectContaining({ id: 2, medicalRecordNumber: '99' }));
  });
});
