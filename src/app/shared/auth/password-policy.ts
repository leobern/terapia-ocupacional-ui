export const PASSWORD_MIN_LENGTH = 8;

export type PasswordViolation = 'min-length' | 'lowercase' | 'uppercase' | 'digit';

/**
 * Política de senha única (RN04), a ser reutilizada pelo cadastro (US-001-1-02).
 * PREMISSA: o texto da story não define a política; adotada: mínimo de 8 caracteres
 * com letra minúscula, maiúscula e dígito. Confirmar com a story de cadastro.
 */
export function validatePassword(password: string): PasswordViolation[] {
  const violations: PasswordViolation[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    violations.push('min-length');
  }
  if (!/[a-z]/.test(password)) {
    violations.push('lowercase');
  }
  if (!/[A-Z]/.test(password)) {
    violations.push('uppercase');
  }
  if (!/\d/.test(password)) {
    violations.push('digit');
  }

  return violations;
}
