import { NutritionFunctionalAssessment } from './assessment.models';

/**
 * Porta de leitura da Avaliação Nutricional e Funcional (FT-004-4). Sem contrato de API: a implementação
 * real substitui a provisória em `app.config.ts`. Offline, devolve a cópia local quando existir.
 * Devolve `null` quando o paciente não tem avaliação anterior; rejeita quando a leitura falha.
 */
export abstract class AssessmentSource {
  abstract loadLatest(patientId: string): Promise<NutritionFunctionalAssessment | null>;
}
