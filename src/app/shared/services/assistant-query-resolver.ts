import { InjectionToken } from '@angular/core';

/** Resposta de uma consulta de leitura: um resumo e, opcionalmente, itens listados abaixo dele. */
export interface AssistantAnswer {
  readonly summary: string;
  readonly items?: readonly string[];
}

/**
 * Ponto de extensão das consultas de leitura do assistente: um resolvedor por intenção.
 * O reconhecimento é simples e substituível (o motor de IA/NLU está fora de escopo).
 */
export interface AssistantQueryResolver {
  /** `true` se este resolvedor sabe responder à pergunta. */
  matches(question: string): boolean;
  resolve(question: string): Promise<AssistantAnswer>;
}

export const ASSISTANT_QUERY_RESOLVERS = new InjectionToken<readonly AssistantQueryResolver[]>(
  'ASSISTANT_QUERY_RESOLVERS',
  { factory: (): readonly AssistantQueryResolver[] => [], providedIn: 'root' },
);

/** Normaliza para comparação: minúsculas, sem acentos e sem pontuação. */
export function normalizeQuestion(question: string): string {
  return question
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const UNRECOGNIZED_ANSWER: AssistantAnswer = {
  summary: 'Ainda não sei responder a essa pergunta.',
};

export const GENERIC_ERROR_MESSAGE = 'Não foi possível obter a resposta agora. Tente novamente em instantes.';
