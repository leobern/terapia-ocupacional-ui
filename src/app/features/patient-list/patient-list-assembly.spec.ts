import { CensusPatient } from './patient-list.models';
import { assemblePatientList } from './patient-list-assembly';

const base: CensusPatient = {
  adequacy: { caloric: 80, protein: 70 },
  admissionStatus: 'ADMITTED_BY_EMTN',
  bed: '1',
  birthDate: '2000-01-19',
  completedCycles: 1,
  hospitalId: 1,
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
        { ...base, hospitalId: 2, id: 'd' },
      ],
      1,
      day,
    );

    expect(list.map(p => p.id)).toEqual(['a']);
  });

  it('calcula a idade antes e depois do aniversário e expõe a data de nascimento', () => {
    const before = assemblePatientList([base], 1, new Date(2026, 0, 18))[0];
    const after = assemblePatientList([base], 1, new Date(2026, 0, 19))[0];
    const earlierMonth = assemblePatientList([base], 1, new Date(2026, 0, 1))[0];

    expect(before.age).toBe(25);
    expect(after.age).toBe(26);
    expect(earlierMonth.age).toBe(25);
    expect(before.birthDate).toBe(base.birthDate);
  });

  it('ordena por ala e leito numericamente', () => {
    const list = assemblePatientList(
      [
        { ...base, bed: '10', id: 'x' },
        { ...base, bed: '9', id: 'y' },
        { ...base, id: 'z', ward: 'Ala 0' },
      ],
      1,
      day,
    );

    expect(list.map(p => p.id)).toEqual(['z', 'y', 'x']);
  });

  it('deriva tempo de terapia, adequação espelhada e primeira avaliação', () => {
    const [first] = assemblePatientList([{ ...base, completedCycles: 0 }], 1, day);
    const [done] = assemblePatientList([base], 1, day);
    const [future] = assemblePatientList([{ ...base, therapyStartDate: '2026-02-01' }], 1, day);

    expect(done.therapyDays).toBe(10);
    expect(future.therapyDays).toBe(0);
    expect(done.adequacy).toEqual({ caloric: 80, protein: 70 });
    expect(first.firstEvaluation).toBe(true);
    expect(done.firstEvaluation).toBe(false);
  });

  describe('encerramento de acompanhamento (FR-031/FR-032)', () => {
    const closed = { ...base, followUpEndDate: '2026-01-18' };
    const ids = (d: Date): string[] => assemblePatientList([closed], 1, d).map(p => p.id);

    it('some na data de efeito e depois dela', () => {
      expect(ids(new Date(2026, 0, 18))).toEqual([]);
      expect(ids(new Date(2026, 0, 19, 15))).toEqual([]);
    });

    it('continua visível em datas anteriores', () => {
      expect(ids(new Date(2026, 0, 17, 23))).toEqual(['a']);
    });

    it('sem data de efeito (saiu do fluxo sem confirmar) a lista não muda', () => {
      expect(assemblePatientList([base], 1, day).map(p => p.id)).toEqual(['a']);
    });
  });

  it('marca finalizado só quando não há pendências abertas na data', () => {
    const [done, open, unknown] = assemblePatientList(
      [
        { ...base, bed: '1', id: 'a', pendingTasks: 0, reassessmentDone: true },
        { ...base, bed: '2', id: 'b', pendingTasks: 2 },
        { ...base, bed: '3', id: 'c' },
      ],
      1,
      day,
    );

    expect([done.finished, open.finished, unknown.finished]).toEqual([true, false, false]);
  });

  describe('pendência de reavaliação conforme a cadência do Plano (FT-004-6)', () => {
    // 2026-11-16 é segunda-feira; getDay: seg=1 … dom=0.
    const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 16 + i));
    const due = (patient: Partial<CensusPatient>, d: Date): boolean =>
      assemblePatientList([{ ...base, ...patient }], 1, d)[0].reassessmentDue;

    it('diária: pendente em todos os dias da semana', () => {
      expect(week.map(d => due({ reviewCadence: [0, 1, 2, 3, 4, 5, 6] }, d))).toEqual(Array(7).fill(true));
    });

    it('sem cadência gravada: tratado como diário', () => {
      expect(week.map(d => due({}, d))).toEqual(Array(7).fill(true));
    });

    it('dias específicos: pendente só nesses dias', () => {
      // seg, qua, sex marcados.
      expect(week.map(d => due({ reviewCadence: [1, 3, 5] }, d))).toEqual([
        true,
        false,
        true,
        false,
        true,
        false,
        false,
      ]);
    });

    it('domingo conta como dia 0 da cadência', () => {
      expect(week.map(d => due({ reviewCadence: [0] }, d))).toEqual([false, false, false, false, false, false, true]);
    });

    it('trocar de diária para dias específicos muda a listagem do dia seguinte', () => {
      const tuesday = new Date(2026, 10, 17);

      expect(due({ reviewCadence: [0, 1, 2, 3, 4, 5, 6] }, tuesday)).toBe(true);
      expect(due({ reviewCadence: [1, 5] }, tuesday)).toBe(false);
    });

    it('reavaliação concluída no dia não é mais pendência', () => {
      expect(due({ reassessmentDone: true }, week[0])).toBe(false);
    });

    it('finalizado exige também não haver reavaliação prevista aberta', () => {
      const finished = (patient: Partial<CensusPatient>, d: Date): boolean =>
        assemblePatientList([{ ...base, pendingTasks: 0, ...patient }], 1, d)[0].finished;

      expect(finished({ reviewCadence: [1] }, week[0])).toBe(false);
      expect(finished({ reviewCadence: [1] }, week[1])).toBe(true);
      expect(finished({ reassessmentDone: true }, week[0])).toBe(true);
    });
  });
});
