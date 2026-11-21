import {
  evaluatePrescription,
  FORMULA_NO_DENSITY_HINT,
  minutesOf,
  PAUSE_BEFORE_START_HINT,
  PAUSE_DUPLICATED_HINT,
  PAUSE_REQUIRED_HINT,
  PrescriptionDraft,
  toPrescription,
} from './prescription.models';

const formula = { id: 'f1', kcalPerMl: 1.5, name: 'Hiper', proteinPerMl: 0.06 };
const targets = { kcalPerDay: 1800, proteinPerDay: 90 };
const base: PrescriptionDraft = {
  formula,
  modality: 'continuous',
  nursingNotes: '',
  pauseTimes: [],
  startTime: '08:00',
  volume: '1200',
};

describe('evaluatePrescription', () => {
  it('contínua usa 24h e compara com a meta', () => {
    const r = evaluatePrescription(base, targets);

    expect(r.valid).toBe(true);
    expect(r.intake).toEqual({
      hours: 24,
      kcal: 1800,
      kcalPercent: 100,
      protein: 72,
      proteinPercent: 80,
      rateMlPerHour: 50,
    });
  });

  it('aceita vírgula no volume', () => {
    expect(evaluatePrescription({ ...base, volume: '1200,5' }, null).intake?.kcal).toBe(1800.8);
  });

  it('sem meta calcula o aporte absoluto e deixa o percentual indisponível', () => {
    const r = evaluatePrescription(base, null);

    expect(r.intake?.kcal).toBe(1800);
    expect(r.intake?.kcalPercent).toBeNull();
    expect(r.intake?.proteinPercent).toBeNull();
  });

  it('intermitente usa as horas do início até a última pausa, não 24h', () => {
    const r = evaluatePrescription({ ...base, modality: 'intermittent', pauseTimes: ['12:00', '20:00'] }, targets);

    expect(r.valid).toBe(true);
    expect(r.intake?.hours).toBe(12);
    expect(r.intake?.rateMlPerHour).toBe(100);
  });

  it('cíclica sem pausa é inválida e não calcula aporte', () => {
    const r = evaluatePrescription({ ...base, modality: 'cyclic' }, targets);

    expect(r.valid).toBe(false);
    expect(r.errors.pauseTimes).toBe(PAUSE_REQUIRED_HINT);
    expect(r.intake).toBeNull();
  });

  it('pausa mal formada conta como ausente', () => {
    expect(evaluatePrescription({ ...base, modality: 'cyclic', pauseTimes: ['xx'] }, null).errors.pauseTimes).toBe(
      PAUSE_REQUIRED_HINT,
    );
  });

  it('pausa antes do início e pausas repetidas são sinalizadas', () => {
    const before = evaluatePrescription({ ...base, modality: 'intermittent', pauseTimes: ['07:00'] }, null);
    const dup = evaluatePrescription({ ...base, modality: 'intermittent', pauseTimes: ['12:00', '12:00'] }, null);

    expect(before.errors.pauseTimes).toBe(PAUSE_BEFORE_START_HINT);
    expect(dup.errors.pauseTimes).toBe(PAUSE_DUPLICATED_HINT);
  });

  for (const volume of ['', '0', '-5', 'abc']) {
    it(`volume "${volume}" não gera aporte`, () => {
      const r = evaluatePrescription({ ...base, volume }, targets);

      expect(r.valid).toBe(false);
      expect(r.intake).toBeNull();
      expect(r.errors.volume).toBeDefined();
    });
  }

  it('exige fórmula e densidade', () => {
    expect(evaluatePrescription({ ...base, formula: null }, targets).errors.formula).toBeDefined();
    const semDensidade = evaluatePrescription({ ...base, formula: { ...formula, kcalPerMl: null } }, targets);

    expect(semDensidade.errors.formula).toBe(FORMULA_NO_DENSITY_HINT);
    expect(semDensidade.intake).toBeNull();
  });

  it('exige horário de início válido', () => {
    expect(evaluatePrescription({ ...base, startTime: '' }, targets).errors.startTime).toBeDefined();
  });
});

describe('minutesOf', () => {
  it('converte HH:MM e rejeita o inválido', () => {
    expect(minutesOf('08:30')).toBe(510);
    expect(minutesOf('24:00')).toBeNull();
  });
});

describe('toPrescription', () => {
  const ctx = { at: '2026-11-21T10:00:00Z', author: 'Dra. Ana' };

  it('monta a prescrição com autor e data, aparando as orientações', () => {
    const p = toPrescription({ ...base, nursingNotes: '  não desconectar  ' }, ctx);

    expect(p).toEqual(
      jasmine.objectContaining({
        author: 'Dra. Ana',
        formulaId: 'f1',
        nursingNotes: 'não desconectar',
        volumeMl: 1200,
      }),
    );

    expect(p?.pauseTimes).toEqual([]);
  });

  it('guarda as pausas ordenadas em modalidade não contínua', () => {
    const p = toPrescription({ ...base, modality: 'cyclic', pauseTimes: ['20:00', '12:00'] }, ctx);

    expect(p?.pauseTimes).toEqual(['12:00', '20:00']);
  });

  it('devolve null se inválida', () => {
    expect(toPrescription({ ...base, volume: '' }, ctx)).toBeNull();
  });
});
