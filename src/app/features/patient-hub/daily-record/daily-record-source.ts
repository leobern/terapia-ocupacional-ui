import { ParameterEntry } from './daily-record.models';

/**
 * Porta de leitura do Registro diário (FT-004-7). Sem contrato de API: a implementação real substitui a
 * provisória em `app.config.ts`. Devolve todos os lançamentos do paciente; rejeita quando a leitura falha.
 */
export abstract class DailyRecordSource {
  abstract loadEntries(patientId: string): Promise<readonly ParameterEntry[]>;
}
