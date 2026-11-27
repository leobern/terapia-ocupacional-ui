import { Injectable, signal } from '@angular/core';

import { SessionTokens } from '../auth/local-session-store';

/** Resultado de verificar um código (do app autenticador ou de recuperação) ou de confirmar a ativação. */
export type MfaResult =
  | { readonly kind: 'success'; readonly tokens: SessionTokens; readonly recoveryCodes?: readonly string[] }
  | { readonly kind: 'invalid-code' }
  /** Excesso de tentativas de código. */
  | { readonly kind: 'locked' }
  /** O desafio do login expirou: é preciso entrar de novo. */
  | { readonly kind: 'expired' }
  | { readonly kind: 'network-error' };

/** Dados para cadastrar o app autenticador (o QR code é desenhado a partir de `otpauthUri`). */
export interface MfaSetup {
  /** Chave em texto (base32), para digitar no app quando não der para ler o QR. */
  readonly secret: string;
  readonly otpauthUri: string;
}

/**
 * Fronteira do segundo fator (TOTP, obrigatório para ADMIN e GESTOR). Contrato PROPOSTO, ainda inexistente no backend
 * (`docs/regras-de-negocio/pendencias-backend-acesso.md`): o login responde 202 com um desafio (`mfaToken`) e estes
 * endpoints o trocam pelos tokens da sessão. Nunca rejeita: falhas viram `network-error`.
 */
export abstract class MfaGateway {
  abstract verify(challenge: string, code: string): Promise<MfaResult>;
  abstract recover(challenge: string, recoveryCode: string): Promise<MfaResult>;
  /** Gera o segredo do primeiro acesso; `null` em falha. */
  abstract beginSetup(challenge: string): Promise<MfaSetup | null>;
  /** Confirma o primeiro código e devolve os códigos de recuperação junto com os tokens. */
  abstract confirmSetup(challenge: string, code: string): Promise<MfaResult>;
}

/** Desafio de MFA em andamento entre o login e as telas de verificação (só em memória: recarregar volta ao login). */
@Injectable({ providedIn: 'root' })
export class MfaChallengeStore {
  readonly current = signal<{ readonly token: string; readonly setupRequired: boolean } | null>(null);
}
