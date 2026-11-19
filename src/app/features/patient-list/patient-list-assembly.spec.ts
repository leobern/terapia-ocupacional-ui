import { CensusPatient } from './patient-list.models';
import { assemblePatientList } from './patient-list-assembly';

const base: CensusPatient = {
  adequacy: { caloric: 80, protein: 70 },
  admissionStatus: 'ADMITTED_BY_EMTN',
  bed: '1',
  birthDate: '2000-01-19',
  completedCycles: 1,
  hospitalId: 'h1',
  id: 'a',
  name: 'Ana',
  registeredInConductia: true,
  therapy: 'VO',
  therapyStartDate: '2026-01-08',
  ward: 'Ala 1',
};

describe('assemblePatientList', () => {
  const day = new Date(2026, 0, 18);

  it('exclui não admitidos, não cadastrados e de outro hospital (FR-002)', () => {
    const list = assemblePatientList(
      [
        base,
        { ...base, admissionStatus: 'NOT_ADMITTED', id: 'b' },
        { ...base, id: 'c', registeredInConductia: false },
        { ...base, hospitalId: 'h2', id: 'd' },
      ],
      'h1',
      day,
    );

    expect(list.map(p => p.id)).toEqual(['a']);
  });

  it('calcula a idade antes e depois do aniversário e não expõe data de nascimento', () => {
    const before = assemblePatientList([base], 'h1', new Date(2026, 0, 18))[0];
    const after = assemblePatientList([base], 'h1', new Date(2026, 0, 19))[0];
    const earlierMonth = assemblePatientList([base], 'h1', new Date(2026, 0, 1))[0];

    expect(before.age).toBe(25);
    expect(after.age).toBe(26);
    expect(earlierMonth.age).toBe(25);
    expect('birthDate' in before).toBe(false);
  });

  it('ordena por ala e leito numericamente', () => {
    const list = assemblePatientList(
      [
        { ...base, bed: '10', id: 'x' },
        { ...base, bed: '9', id: 'y' },
        { ...base, id: 'z', ward: 'Ala 0' },
      ],
      'h1',
      day,
    );

    expect(list.map(p => p.id)).toEqual(['z', 'y', 'x']);
  });

  it('deriva tempo de terapia, adequação espelhada e primeira avaliação', () => {
    const [first] = assemblePatientList([{ ...base, completedCycles: 0 }], 'h1', day);
    const [done] = assemblePatientList([base], 'h1', day);
    const [future] = assemblePatientList([{ ...base, therapyStartDate: '2026-02-01' }], 'h1', day);

    expect(done.therapyDays).toBe(10);
    expect(future.therapyDays).toBe(0);
    expect(done.adequacy).toEqual({ caloric: 80, protein: 70 });
    expect(first.firstEvaluation).toBe(true);
    expect(done.firstEvaluation).toBe(false);
  });
});
