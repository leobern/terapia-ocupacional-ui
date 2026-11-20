import { AssessmentFieldId } from './assessment.models';

/** Valores por campo devolvidos pela IA; campo não citado no áudio fica ausente. */
export type StructuredAssessment = Readonly<Partial<Record<AssessmentFieldId, string>>>;

/**
 * Porta de estruturação por IA da Avaliação Nutricional e Funcional (FT-004-4, US-004-4-03): recebe o
 * áudio narrado e devolve os valores por campo. Sem contrato de API: a implementação real substitui a
 * provisória em `app.config.ts`. Rejeita quando a IA está indisponível ou falha. Nunca grava nada.
 */
export abstract class AssessmentAiStructurer {
  abstract structure(audio: Blob): Promise<StructuredAssessment>;
}
