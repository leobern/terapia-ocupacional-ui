import { PatientMeasures } from './measures-source';
import { buildMeasuresView } from './measures-view';

const RANGE = { max: 24.9, min: 18.5 };
const TODAY = new Date(2026, 10, 26, 12, 0, 0);

function measures(points: PatientMeasures['points'], admissionWeightKg: number | null = 60): PatientMeasures {
  return { admissionDate: '2026-11-20', admissionWeightKg, bmiIdealRange: RANGE, points };
}

const at = (day: number, hour = 9): string => new Date(2026, 10, day, hour, 5, 0).toISOString();

describe('buildMeasuresView', () => {
  it('sem medições não há gráfico (estado vazio)', () => {
    const view = buildMeasuresView(measures([], null), TODAY);

    expect(view.weight).toBeNull();
    expect(view.bmi).toBeNull();
  });

  it('peso: série, legenda de hoje, selo de variação e referência da internação', () => {
    const view = buildMeasuresView(
      measures([
        { at: at(20), bmi: 22.6, heightCm: 163, weightKg: 60 },
        { at: at(26, 14), bmi: 23.5, heightCm: 163, weightKg: 62.5 },
      ]),
      TODAY,
    );

    expect(view.weight?.series).toEqual([
      { label: '20/11', note: 'avaliação clínica · 09:05', value: 60 },
      { label: '26/11', note: 'avaliação clínica · 14:05', value: 62.5 },
    ]);

    expect(view.weight?.caption).toBe('Medido hoje, 26/11 · 2 medições');
    expect(view.weight?.badge).toEqual({ icon: 'arrow-up', text: '+2,5 kg desde 20/11' });
    expect(view.weight?.reference).toEqual({ label: 'Internação · 60 kg', value: 60 });
    expect(view.weight?.idealRange).toBeNull();
  });

  it('peso: perda, estável e medição única sem selo; legenda de dia anterior; sem peso de internação', () => {
    const loss = buildMeasuresView(
      measures([
        { at: at(20), bmi: null, heightCm: null, weightKg: 60 },
        { at: at(22), bmi: null, heightCm: null, weightKg: 58 },
      ]),
      TODAY,
    );
    const stable = buildMeasuresView(
      measures([
        { at: at(20), bmi: null, heightCm: null, weightKg: 60 },
        { at: at(22), bmi: null, heightCm: null, weightKg: 60 },
      ]),
      TODAY,
    );
    const single = buildMeasuresView(measures([{ at: at(22), bmi: null, heightCm: null, weightKg: 60 }], null), TODAY);

    expect(loss.weight?.badge).toEqual({ icon: 'arrow-down', text: '−2 kg desde 20/11' });
    expect(loss.weight?.caption).toBe('Medido em 22/11 · 2 medições');
    expect(stable.weight?.badge).toEqual({ icon: 'check', text: 'Estável desde 20/11' });
    expect(single.weight?.badge).toBeNull();
    expect(single.weight?.caption).toBe('Medido em 22/11 · 1 medição');
    expect(single.weight?.reference).toBeNull();
  });

  it('IMC ausente (sem altura): o gráfico de IMC não aparece, o de peso sim', () => {
    const view = buildMeasuresView(measures([{ at: at(20), bmi: null, heightCm: null, weightKg: 60 }]), TODAY);

    expect(view.bmi).toBeNull();
    expect(view.weight).not.toBeNull();
  });

  it('IMC usa só medições com altura; legenda com altura e faixa; selo "na faixa desde"', () => {
    const view = buildMeasuresView(
      measures([
        { at: at(20), bmi: 17.9, heightCm: 163, weightKg: 47.5 },
        { at: at(21), bmi: null, heightCm: null, weightKg: 50 },
        { at: at(22), bmi: 19.2, heightCm: 163, weightKg: 51 },
        { at: at(24), bmi: 20.1, heightCm: 163, weightKg: 53.4 },
      ]),
      TODAY,
    );

    expect(view.bmi?.series.map(p => p.value)).toEqual([17.9, 19.2, 20.1]);
    expect(view.bmi?.caption).toBe('Altura 1,63 m · faixa ideal 18,5–24,9');
    expect(view.bmi?.badge).toEqual({ icon: 'check', text: 'Na faixa ideal desde 22/11' });
    expect(view.bmi?.idealRange).toEqual([18.5, 24.9]);
    expect(view.bmi?.reference).toEqual({ label: '18,5 · início da faixa ideal', value: 18.5 });
  });

  it('IMC fora da faixa: abaixo e acima', () => {
    const below = buildMeasuresView(measures([{ at: at(20), bmi: 17, heightCm: 170, weightKg: 49 }]), TODAY);
    const above = buildMeasuresView(measures([{ at: at(20), bmi: 30, heightCm: 170, weightKg: 87 }]), TODAY);

    expect(below.bmi?.badge).toEqual({ icon: 'arrow-down', text: 'Abaixo da faixa ideal' });
    expect(above.bmi?.badge).toEqual({ icon: 'arrow-up', text: 'Acima da faixa ideal' });
  });

  it('IMC sem altura na última medição com IMC: legenda só com a faixa', () => {
    const view = buildMeasuresView(measures([{ at: at(20), bmi: 20, heightCm: null, weightKg: 55 }]), TODAY);

    expect(view.bmi?.caption).toBe('Faixa ideal 18,5–24,9');
  });
});
