/** Medição da série (`PontoMedida` de openapi/medidas-api.yaml). */
export interface MeasurementPoint {
  /** Data e hora da gravação. */
  readonly at: string;
  /** IMC em kg/m² com uma casa; `null` quando a versão não tem altura (nenhuma altura é inventada). */
  readonly bmi: number | null;
  readonly heightCm: number | null;
  readonly weightKg: number;
}

/** Série de peso e IMC da internação atual (`Medidas` do contrato), em ordem cronológica crescente. */
export interface PatientMeasures {
  readonly admissionDate: string | null;
  readonly admissionWeightKg: number | null;
  readonly bmiIdealRange: { readonly max: number; readonly min: number };
  readonly points: readonly MeasurementPoint[];
}

/**
 * Porta de leitura das medidas dos gráficos de Peso e IMC do Hub. O servidor devolve a internação inteira; o
 * filtro de período seria da UI (hoje o gráfico mostra a internação toda, como no Figma). Rejeita em caso de
 * falha (a tela mantém o que já exibe).
 */
export abstract class MeasuresSource {
  abstract load(patientId: string): Promise<PatientMeasures>;
}
