import { GlimResult } from './diagnosis.models';
import { ProvisionalDiagnosisDecisionSource } from './provisional-diagnosis-decision-source';

const RESULT: GlimResult = {
  criteria: {
    inflammation: 'positive',
    'low-bmi': 'negative',
    'low-muscle-mass': 'not-evaluated',
    'reduced-intake': 'positive',
    'weight-loss': 'positive',
  },
  outcome: 'confirmed',
  staging: 'moderate',
};
const base = { author: 'Dra. Ana', current: RESULT, patientId: 'p1' };

describe('ProvisionalDiagnosisDecisionSource', () => {
  it('começa vazio', async () => {
    const record = await new ProvisionalDiagnosisDecisionSource().load('p1');

    expect(record.decision).toBeNull();
    expect(record.audit).toEqual([]);
  });

  it('confirmar guarda a decisão e audita; a última prevalece', async () => {
    const source = new ProvisionalDiagnosisDecisionSource();

    await source.apply({ ...base, action: 'confirm', at: '2026-11-20T10:00:00' });
    const record = await source.apply({ ...base, action: 'confirm', at: '2026-11-20T11:00:00' });

    expect(record.decision?.at).toBe('2026-11-20T11:00:00');
    expect(record.audit.length).toBe(2);
    expect((await source.load('p1')).decision?.status).toBe('confirmed');
  });

  it('excluir guarda a decisão como excluída', async () => {
    const record = await new ProvisionalDiagnosisDecisionSource().apply({
      ...base,
      action: 'exclude',
      at: '2026-11-20T10:00:00',
    });

    expect(record.decision?.status).toBe('excluded');
  });

  it('alterar guarda o override e audita antes e depois', async () => {
    const altered: GlimResult = { ...RESULT, outcome: 'excluded', staging: null };
    const record = await new ProvisionalDiagnosisDecisionSource().apply({
      ...base,
      action: 'alter',
      altered,
      at: '2026-11-20T10:00:00',
    });

    expect(record.override).toEqual(altered);
    expect(record.decision).toBeNull();
    expect(record.audit[0].before).toEqual(RESULT);
    expect(record.audit[0].after).toEqual(altered);
  });
});
