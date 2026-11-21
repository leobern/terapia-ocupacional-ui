import { NewParameterEntry, ParameterEntry } from './daily-record.models';

/**
 * Porta de gravação do Registro diário (FT-004-7), ao lado de `DailyRecordSource`. Cada lançamento é um
 * ponto novo, nunca sobrescreve outro. Sem contrato de API; rejeita quando a gravação falha (nada é gravado).
 */
export abstract class DailyRecordWriter {
  abstract record(patientId: string, entries: readonly NewParameterEntry[]): Promise<readonly ParameterEntry[]>;
}
