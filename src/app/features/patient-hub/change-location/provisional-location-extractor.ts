import { Injectable } from '@angular/core';

import { LocationExtractor, type LocationRequest } from './location-change.port';

const KEYWORD = /\b(unidade|ala)\b/i;
const LINK = /^(?:(?:para|pra|é|e)\s+|[:=]\s*)/i;
const ARTICLE = /^[oa]\s+/i;

/** Extrator provisório: o tipo é a primeira palavra "unidade"/"ala"; o valor é o que vem depois dela. */
@Injectable()
export class ProvisionalLocationExtractor extends LocationExtractor {
  extract(message: string): LocationRequest | null {
    const found = KEYWORD.exec(message);

    if (!found) {
      return null;
    }
    const rest = message
      .slice(found.index + found[0].length)
      .trim()
      .replace(LINK, '')
      .replace(ARTICLE, '');

    return { type: found[1].toLowerCase() === 'ala' ? 'ALA' : 'UNIDADE', value: rest.trim() };
  }
}
