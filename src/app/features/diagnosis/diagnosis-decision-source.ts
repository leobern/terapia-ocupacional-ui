import { DiagnosisActionRequest, DiagnosisRecord } from './diagnosis.models';

/**
 * Porta de leitura e gravação da decisão do médico sobre o diagnóstico GLIM (FT-004-5, US-004-5-02).
 * Sem contrato de API: a implementação real substitui a provisória em `app.config.ts`. `apply` grava a
 * decisão e acrescenta a entrada de auditoria imutável na mesma operação; ambos rejeitam em caso de
 * falha. Última decisão prevalece (sem lock), cada uma auditada.
 */
export abstract class DiagnosisDecisionSource {
  abstract load(patientId: string): Promise<DiagnosisRecord>;
  abstract apply(request: DiagnosisActionRequest): Promise<DiagnosisRecord>;
}
