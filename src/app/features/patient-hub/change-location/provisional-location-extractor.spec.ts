import { ProvisionalLocationExtractor } from './provisional-location-extractor';

describe('ProvisionalLocationExtractor', () => {
  const extractor = new ProvisionalLocationExtractor();

  it('extracts unit and value from "unidade UTI"', () => {
    expect(extractor.extract('unidade UTI')).toEqual({ type: 'UNIDADE', value: 'UTI' });
  });

  it('extracts ward after "para"', () => {
    expect(extractor.extract('mudar a ala para Ala Norte')).toEqual({ type: 'ALA', value: 'Ala Norte' });
  });

  it('returns an empty value when only the keyword is given', () => {
    expect(extractor.extract('mudar a ala')).toEqual({ type: 'ALA', value: '' });
  });

  it('returns null without keyword', () => {
    expect(extractor.extract('olá')).toBeNull();
  });
});
