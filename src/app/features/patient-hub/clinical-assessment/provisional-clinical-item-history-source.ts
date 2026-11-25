import { Injectable } from '@angular/core';

import { ClinicalItemTemplate } from './clinical-assessment.models';
import { ClinicalItemHistorySource } from './clinical-item-history-source';

const KEY = 'conductia:clinical-item-history';
const LIMIT = 50;

/** Provisório: guarda no `localStorage`, sem repetir o título (a versão mais recente vence). */
@Injectable()
export class ProvisionalClinicalItemHistorySource extends ClinicalItemHistorySource {
  load(): Promise<readonly ClinicalItemTemplate[]> {
    const raw = localStorage.getItem(KEY);

    return Promise.resolve(raw === null ? [] : (JSON.parse(raw) as ClinicalItemTemplate[]));
  }

  async remember(items: readonly ClinicalItemTemplate[]): Promise<void> {
    const previous = await this.load();
    const keys = new Set(items.map(i => i.title.trim().toLowerCase()));
    const merged = [...items, ...previous.filter(i => !keys.has(i.title.trim().toLowerCase()))].slice(0, LIMIT);

    localStorage.setItem(KEY, JSON.stringify(merged));
  }
}
