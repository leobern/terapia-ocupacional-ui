import { ClinicalAssessment } from './clinical-assessment.models';

/**
 * Porta de leitura e gravação da avaliação clínica do paciente (tipo de TN, dispositivo, peso, altura e itens livres).
 * Sem contrato de API ainda: a implementação real substitui a provisória em `app.config.ts`. Ambos rejeitam em falha.
 * A trilha de auditoria (autor e data/hora de cada alteração) é feita no backend.
 */
export abstract class ClinicalAssessmentSource {
  abstract load(patientId: string): Promise<ClinicalAssessment>;
  abstract save(patientId: string, assessment: ClinicalAssessment): Promise<void>;
}
