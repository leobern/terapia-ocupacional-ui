import { SuggestedParameter } from './daily-record.models';

/**
 * Porta do serviço de IA que transforma o áudio narrado pelo profissional em parâmetros assistenciais
 * estruturados (FT-004-7, US-004-7-02), de qualquer categoria. Sem contrato de API: a implementação real
 * substitui a provisória em `app.config.ts` (o serviço de IA em si está fora de escopo). Devolve lista vazia
 * quando nada foi reconhecido; rejeita quando a IA está indisponível ou falha. Nunca grava nada.
 */
export abstract class ParameterAiStructurer {
  abstract suggest(audio: Blob): Promise<readonly SuggestedParameter[]>;
}
