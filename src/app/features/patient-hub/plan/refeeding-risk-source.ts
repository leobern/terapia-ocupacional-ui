/** Resultado do motor externo de risco de síndrome de realimentação para um paciente. */
export interface RefeedingRisk {
  /** Os dados já coletados indicam risco (calculado fora desta feature, FR-018). */
  readonly atRisk: boolean;
  /** A meta calórica/proteica já foi atingida: o alerta perde relevância (FR-005). */
  readonly targetReached: boolean;
}

/**
 * Porta de leitura do risco de síndrome de realimentação (FT-004-6, US-004-6-02). O cálculo é de um motor
 * externo, fora de escopo; a implementação real substitui a provisória em `app.config.ts`. Rejeita em caso
 * de falha (o Plano degrada para "sem alerta").
 */
export abstract class RefeedingRiskSource {
  abstract load(patientId: string): Promise<RefeedingRisk>;
}
