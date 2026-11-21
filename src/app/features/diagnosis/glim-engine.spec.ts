import { GlimCriterionId, GlimCriterionState, GlimReading } from './diagnosis.models';
import { evaluateGlim } from './glim-engine';

const IDS: readonly GlimCriterionId[] = ['weight-loss', 'low-bmi', 'low-muscle-mass', 'reduced-intake', 'inflammation'];

function reading(
  states: Partial<Record<GlimCriterionId, GlimCriterionState>>,
  extra: Partial<GlimReading> = {},
): GlimReading {
  const criteria = Object.fromEntries(IDS.map(id => [id, states[id] ?? 'not-evaluated'])) as GlimReading['criteria'];

  return { criteria, fluidRetention: false, protocols: [], screeningPositive: true, severity: {}, ...extra };
}

describe('evaluateGlim', () => {
  it('does not calculate without a positive screening', () => {
    expect(
      evaluateGlim(reading({ inflammation: 'positive', 'weight-loss': 'positive' }, { screeningPositive: false })),
    ).toEqual({
      outcome: 'no-screening',
      staging: null,
    });
  });

  it('confirms with one phenotypic and one etiologic positive', () => {
    expect(evaluateGlim(reading({ 'low-bmi': 'positive', 'reduced-intake': 'positive' })).outcome).toBe('confirmed');
  });

  it('stages moderate from weight loss', () => {
    const r = reading(
      { inflammation: 'positive', 'weight-loss': 'positive' },
      { severity: { 'weight-loss': 'moderate' } },
    );

    expect(evaluateGlim(r)).toEqual({ outcome: 'confirmed', staging: 'moderate' });
  });

  it('stages severe when either weight loss or BMI is severe', () => {
    const r = reading(
      { inflammation: 'positive', 'low-bmi': 'positive', 'weight-loss': 'positive' },
      { severity: { 'low-bmi': 'severe', 'weight-loss': 'moderate' } },
    );

    expect(evaluateGlim(r).staging).toBe('severe');
  });

  it('ignores the grade of a criterion that is not positive', () => {
    const r = reading(
      { inflammation: 'positive', 'low-bmi': 'negative', 'low-muscle-mass': 'positive' },
      { severity: { 'low-bmi': 'severe' } },
    );

    expect(evaluateGlim(r)).toEqual({ outcome: 'confirmed', staging: null });
  });

  it('excludes when all 5 are evaluated and none positive', () => {
    const all = Object.fromEntries(IDS.map(id => [id, 'negative'])) as Record<GlimCriterionId, GlimCriterionState>;

    expect(evaluateGlim(reading(all)).outcome).toBe('excluded');
  });

  it('is indeterminate when partially evaluated and none positive', () => {
    expect(evaluateGlim(reading({ 'low-bmi': 'negative' })).outcome).toBe('indeterminate');
  });

  it('is indeterminate with positives in only one group', () => {
    expect(evaluateGlim(reading({ 'low-bmi': 'positive', 'low-muscle-mass': 'positive' })).outcome).toBe(
      'indeterminate',
    );
  });

  it('is not excluded when every criterion is evaluated but one group has a positive', () => {
    const r = reading({
      inflammation: 'negative',
      'low-bmi': 'negative',
      'low-muscle-mass': 'negative',
      'reduced-intake': 'negative',
      'weight-loss': 'positive',
    });

    expect(evaluateGlim(r).outcome).toBe('indeterminate');
  });
});
