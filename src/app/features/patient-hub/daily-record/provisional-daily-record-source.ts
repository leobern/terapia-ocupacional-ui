import { Injectable } from '@angular/core';

import { NewParameterEntry, ParameterEntry } from './daily-record.models';
import { DailyRecordSource } from './daily-record-source';
import { DailyRecordWriter } from './daily-record-writer';

/** Provisório: guarda os lançamentos em memória, por paciente, até a API real existir. */
@Injectable()
export class ProvisionalDailyRecordSource extends DailyRecordSource implements DailyRecordWriter {
  private readonly entries = new Map<string, readonly ParameterEntry[]>();
  private sequence = 0;

  loadEntries(patientId: string): Promise<readonly ParameterEntry[]> {
    return Promise.resolve(this.entries.get(patientId) ?? []);
  }

  record(patientId: string, entries: readonly NewParameterEntry[]): Promise<readonly ParameterEntry[]> {
    const created = entries.map(entry => ({ ...entry, id: `entry-${++this.sequence}` }));

    this.entries.set(patientId, [...(this.entries.get(patientId) ?? []), ...created]);

    return Promise.resolve(created);
  }
}
