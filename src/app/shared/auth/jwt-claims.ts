/** Claims do access token usados pela interface (o backend emite `groups`, `upn` e `nomeCompleto`). */
export interface AccessTokenClaims {
  readonly groups?: unknown;
  readonly nomeCompleto?: unknown;
  readonly upn?: unknown;
}

/**
 * Lê o payload de um JWT SEM validar a assinatura (quem valida é o backend): serve só para exibir
 * nome e perfil e para controle de interface. Decodifica como UTF-8 (`atob` sozinho estraga acentos).
 * Falha fechada: token ausente ou malformado vira `{}`.
 */
export function readClaims(token: string | null): AccessTokenClaims {
  try {
    const payload = token?.split('.')[1];

    if (!payload) {
      return {};
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const json = new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
    const claims = JSON.parse(json) as unknown;

    return typeof claims === 'object' && claims !== null ? (claims as AccessTokenClaims) : {};
  } catch {
    return {};
  }
}
