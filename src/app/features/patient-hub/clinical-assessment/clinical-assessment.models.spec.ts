import {
  bodyMassIndex,
  clinicalErrors,
  clinicalStatus,
  deviceLabel,
  formatClinicalNumber,
  parseClinicalValue,
  tnLabel,
} from './clinical-assessment.models';

describe('clinical-assessment.models', () => {
  const calf = {
    ranges: [
      { from: 0, label: 'Abaixo', to: 10, tone: 'alert' as const },
      { from: 11, label: 'Limítrofe', to: 40, tone: 'warning' as const },
      { from: 50, label: 'Acima', to: 100, tone: 'info' as const },
    ],
    value: '31',
  };

  it('parseClinicalValue lê o primeiro número, com vírgula ou ponto', () => {
    expect(parseClinicalValue('4,2')).toBe(4.2);
    expect(parseClinicalValue('183–257')).toBe(183);
    expect(parseClinicalValue('31 cm')).toBe(31);
    expect(parseClinicalValue('abc')).toBeNull();
  });

  it('clinicalStatus devolve a faixa que contém o valor (e nada quando não há faixa ou o valor não é número)', () => {
    expect(clinicalStatus(calf)).toEqual({ label: 'Limítrofe', tone: 'warning' });
    expect(clinicalStatus({ ...calf, value: '5' })).toEqual({ label: 'Abaixo', tone: 'alert' });
    expect(clinicalStatus({ ...calf, value: '45' })).toBeNull();
    expect(clinicalStatus({ ranges: [], value: '4' })).toBeNull();
    expect(clinicalStatus({ ...calf, value: 'sem dado' })).toBeNull();
  });

  it('bodyMassIndex calcula do peso e da altura; sem um deles, não calcula', () => {
    expect(bodyMassIndex(51, 153)).toBeCloseTo(21.8, 1);
    expect(bodyMassIndex(null, 153)).toBeNull();
    expect(bodyMassIndex(51, null)).toBeNull();
    expect(bodyMassIndex(0, 153)).toBeNull();
    expect(bodyMassIndex(51, 0)).toBeNull();
  });

  it('clinicalErrors exige tipo de TN, dispositivo, peso e altura', () => {
    expect(clinicalErrors({ device: '', heightCm: null, tnType: ' ', weightKg: 0 })).toEqual({
      device: 'Informe o dispositivo.',
      heightCm: 'Informe a altura.',
      tnType: 'Informe o tipo de TN.',
      weightKg: 'Informe o peso.',
    });

    expect(clinicalErrors({ device: 'SNE', heightCm: 153, tnType: 'NE', weightKg: 51 })).toEqual({});
  });

  it('rótulos de TN e dispositivo (vazio quando o código é desconhecido) e formato dos números', () => {
    expect(tnLabel('ne')).toBe('enteral');
    expect(tnLabel('XX')).toBe('');
    expect(deviceLabel('SNE')).toBe('sonda');
    expect(deviceLabel('?')).toBe('');
    expect(formatClinicalNumber(51)).toBe('51,0');
    expect(formatClinicalNumber(153, 0)).toBe('153');
  });
});
