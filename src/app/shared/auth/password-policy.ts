export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordViolation = 'min-length' | 'max-length' | 'letter' | 'digit';

/**
 * Política de senha única (RN04), a ser reutilizada pelo cadastro (US-001-1-02).
 * Decisão do dono do produto: senha forte padrão, sem regras específicas de composição:
 * de 10 a 128 caracteres, com ao menos uma letra (qualquer alfabeto) e ao menos um número.
 * Não exige maiúscula, minúscula nem símbolo. A senha não é aparada nem alterada: espaços
 * contam como caracteres. O tamanho é medido em unidades UTF-16 (`String.length`).
 */
export function validatePassword(password: string): PasswordViolation[] {
  const violations: PasswordViolation[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    violations.push('min-length');
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    violations.push('max-length');
  }
  if (!/\p{L}/u.test(password)) {
    violations.push('letter');
  }
  if (!/\d/.test(password)) {
    violations.push('digit');
  }

  return violations;
}
