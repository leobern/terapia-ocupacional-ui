import { validatePassword } from './password-policy';

describe('validatePassword', () => {
  it('accepts a password that meets the policy', () => {
    expect(validatePassword('Senha123')).toEqual([]);
  });

  it('reports every violated rule', () => {
    expect(validatePassword('')).toEqual(['min-length', 'lowercase', 'uppercase', 'digit']);
  });

  it('rejects short passwords', () => {
    expect(validatePassword('Ab1')).toEqual(['min-length']);
  });

  it('requires lowercase, uppercase and digit individually', () => {
    expect(validatePassword('SENHA1234')).toEqual(['lowercase']);
    expect(validatePassword('senha1234')).toEqual(['uppercase']);
    expect(validatePassword('SenhaSenha')).toEqual(['digit']);
  });
});
