import { AssessmentValues } from './assessment.models';

/**
 * Porta de gravação da Avaliação Nutricional e Funcional (FT-004-4), ao lado de `AssessmentSource`.
 * Sem contrato de API: a implementação real substitui a provisória em `app.config.ts`.
 * Rejeita quando a gravação falha.
 */
export abstract class AssessmentWriter {
  abstract save(patientId: string, values: AssessmentValues): Promise<void>;
}
