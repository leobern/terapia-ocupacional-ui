import { ProvisionalBedNumberExtractor } from './provisional-bed-number-extractor';

describe('ProvisionalBedNumberExtractor', () => {
  const extractor = new ProvisionalBedNumberExtractor();

  it('extracts the bed after the word "leito"', () => {
    expect(extractor.extract('mudar para o leito 412')).toBe('412');
    expect(extractor.extract('Transferir para leito nº 302B, por favor')).toBe('302B');
    expect(extractor.extract('mover para o leito UTI-3')).toBe('UTI-3');
    expect(extractor.extract('leito número 12')).toBe('12');
  });

  it('accepts a message that is only the bed number', () => {
    expect(extractor.extract(' 412 ')).toBe('412');
    expect(extractor.extract('302B')).toBe('302B');
  });

  it('returns null when no bed can be identified', () => {
    expect(extractor.extract('preciso mudar uma coisa aqui')).toBeNull();
    expect(extractor.extract('mudar o leito do paciente')).toBeNull();
    expect(extractor.extract('')).toBeNull();
    expect(extractor.extract('abcdefghijklmnopqrstuvwxyz1')).toBeNull();
  });
});
