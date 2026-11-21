/**
 * Porta do serviço de IA que transforma o áudio narrado pelo médico em texto de evolução (FT-004-7,
 * US-004-7-04). Sem contrato de API: a implementação real substitui a provisória em `app.config.ts`
 * (o serviço de IA em si está fora de escopo). Devolve o texto sugerido ('' quando nada foi reconhecido);
 * rejeita quando a IA está indisponível ou falha. Nunca grava nada.
 */
export abstract class EvolutionAiStructurer {
  abstract suggest(audio: Blob): Promise<string>;
}
