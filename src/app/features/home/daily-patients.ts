/** Resumo de pacientes do dia de um hospital. */
export interface DailyPatientsSummary {
  readonly patientCount: number;
  readonly averageCaloricPercentage: number;
  readonly averageProteinPercentage: number;
}

/**
 * Porta de leitura da contagem de pacientes do dia por hospital.
 * Sem contrato de API documentado: a implementação real substitui a provisória em `app.config.ts`.
 */
export abstract class DailyPatientsSource {
  abstract loadForDay(hospitalId: string, day: Date): Promise<DailyPatientsSummary>;
}
