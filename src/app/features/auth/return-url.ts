/** Telas de entrada que nunca servem de destino pós-login (evita laço e retorno a telas sem sessão). */
const EXCLUDED_PATHS: readonly string[] = ['/login', '/lock', '/splash'];

function isExcluded(url: string): boolean {
  return EXCLUDED_PATHS.some(path => url === path || ['/', '?', '#'].some(sep => url.startsWith(path + sep)));
}

/**
 * Aceita só caminho interno do app como destino pós-login (anti open redirect): começa com `/`,
 * não é `//host` nem `/\host` e não é uma das telas de entrada. Qualquer outra coisa vira `null`.
 */
export function safeReturnUrl(candidate: unknown): string | null {
  if (typeof candidate !== 'string' || !candidate.startsWith('/')) {
    return null;
  }

  return candidate.startsWith('//') || candidate.startsWith('/\\') || isExcluded(candidate) ? null : candidate;
}
