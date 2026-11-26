import { readClaims } from './jwt-claims';

function encode(claims: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(claims));
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');

  const base64url = btoa(binary).split('=')[0].replaceAll('+', '-').replaceAll('/', '_');

  return `h.${base64url}.s`;
}

describe('readClaims', () => {
  it('decodifica UTF-8 e base64url sem estragar acentos', () => {
    expect(readClaims(encode({ groups: ['TERAPEUTA'], nomeCompleto: 'José Conceição' }))).toEqual({
      groups: ['TERAPEUTA'],
      nomeCompleto: 'José Conceição',
    });
  });

  it('falha fechada com token ausente, malformado ou que não é objeto', () => {
    expect(readClaims(null)).toEqual({});
    expect(readClaims('abc')).toEqual({});
    expect(readClaims('a.!!!.c')).toEqual({});
    expect(readClaims(encode(3))).toEqual({});
    expect(readClaims(encode(null))).toEqual({});
  });
});
