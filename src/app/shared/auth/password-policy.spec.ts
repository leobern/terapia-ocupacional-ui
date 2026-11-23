import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePassword } from './password-policy';

describe('validatePassword', () => {
  it('exposes the policy limits', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });

  it('accepts a password that meets the policy', () => {
    expect(validatePassword('Senha12345')).toEqual([]);
  });

  it('does not require uppercase, lowercase or symbols', () => {
    expect(validatePassword('senha12345')).toEqual([]);
    expect(validatePassword('SENHA12345')).toEqual([]);
  });

  it('reports every violated rule for an empty password', () => {
    expect(validatePassword('')).toEqual(['min-length', 'letter', 'digit']);
  });

  it('rejects 9 characters and accepts exactly 10', () => {
    expect(validatePassword('senha1234')).toEqual(['min-length']);
    expect(validatePassword('senha12345')).toEqual([]);
  });

  it('accepts exactly 128 characters and rejects 129', () => {
    const base = 'a1';

    expect(validatePassword(base + 'x'.repeat(PASSWORD_MAX_LENGTH - base.length))).toEqual([]);
    expect(validatePassword(base + 'x'.repeat(PASSWORD_MAX_LENGTH - base.length + 1))).toEqual(['max-length']);
  });

  it('requires at least one letter', () => {
    expect(validatePassword('1234567890')).toEqual(['letter']);
  });

  it('requires at least one number', () => {
    expect(validatePassword('abcdefghij')).toEqual(['digit']);
    expect(validatePassword('Abcdefghi!')).toEqual(['digit']);
  });

  it('counts spaces as characters and does not trim', () => {
    expect(validatePassword('          ')).toEqual(['letter', 'digit']);
    expect(validatePassword(' a1       ')).toEqual([]);
    expect(validatePassword('a1        ')).toEqual([]);
    expect(validatePassword('  a1  ')).toEqual(['min-length']);
  });

  it('accepts letters from any alphabet', () => {
    expect(validatePassword('ação123456')).toEqual([]);
    expect(validatePassword('пароль1234')).toEqual([]);
    expect(validatePassword('密码密码密码密码1a')).toEqual([]);
  });

  it('does not treat emoji or symbols as letters', () => {
    expect(validatePassword('😀😀😀😀😀1234')).toEqual(['letter']);
    expect(validatePassword('!!!!!!!!!1')).toEqual(['letter']);
  });
});
