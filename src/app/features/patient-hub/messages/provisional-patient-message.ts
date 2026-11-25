import { Injectable } from '@angular/core';

import { ProfessionalGroup } from './patient-message.models';
import { MessageAiAssistant } from './patient-message-source';

const RULES: readonly { readonly group: ProfessionalGroup; readonly pattern: RegExp }[] = [
  { group: 'nurses', pattern: /\b(sne|sonda|curativo|mucosa|exterioriz)/i },
  { group: 'pharmacists', pattern: /\b(estoque|farm[aá]cia|diluic)/i },
  { group: 'doctors', pattern: /\b(prescri|dose|conduta)/i },
];

/** Provisório: ainda não há serviço de IA; não transcreve e sugere grupos por palavras-chave simples. */
@Injectable()
export class ProvisionalMessageAiAssistant extends MessageAiAssistant {
  transcribe(): Promise<string> {
    return Promise.resolve('');
  }

  suggestGroups(content: string): Promise<readonly ProfessionalGroup[]> {
    return Promise.resolve(RULES.filter(rule => rule.pattern.test(content)).map(rule => rule.group));
  }
}
