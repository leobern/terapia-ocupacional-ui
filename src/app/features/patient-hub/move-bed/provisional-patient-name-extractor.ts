import { Injectable } from '@angular/core';

import { PatientNameExtractor } from './patient-name-extractor';

const WORD = String.raw`[\p{L}'’.-]+`;
const NAME = String.raw`${WORD}(?:\s+${WORD})*?`;
/** Verbo de mudança, artigo/"paciente"/"leito de" opcionais, o nome e o primeiro "para/pro/no/ao/em" que o encerra. */
const AFTER_VERB = new RegExp(
  String.raw`\b(?:mov\p{L}*|trocar|transferir|mudar|alterar)\s+(?:[oa]\s+)?(?:paciente\s+|leito\s+d[aeo]s?\s+)?(${NAME})\s+(?:para|pra|pro|no|ao|em)\b`,
  'iu',
);
const NOT_A_NAME = /^(?:[oa]\s+)?(?:paciente|leito|para|pra|pro)$/i;

/** Extrator provisório: o texto entre o verbo de mudança e o "para o leito". */
@Injectable()
export class ProvisionalPatientNameExtractor extends PatientNameExtractor {
  extract(message: string): string | null {
    const name = AFTER_VERB.exec(message.trim())?.[1]?.trim();

    return name && !NOT_A_NAME.test(name) ? name : null;
  }
}
