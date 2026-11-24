import { Injectable } from '@angular/core';

import { BedNumberExtractor } from './bed-number-extractor';

/** Token de leito: até 20 caracteres, com ao menos um dígito (ex.: `412`, `302B`, `UTI-3`). */
const TOKEN = String.raw`(?=[a-z-]*\d)[a-z0-9-]{1,20}`;
const AFTER_KEYWORD = new RegExp(String.raw`\bleito\s+(?:(?:n[º°o.]|n[uú]m(?:ero)?)\s*)?(${TOKEN})(?![a-z0-9-])`, 'i');
const ONLY_TOKEN = new RegExp(`^(${TOKEN})$`, 'i');

/** Extrator provisório: o número depois de "leito", ou a mensagem inteira quando ela é só o número do leito. */
@Injectable()
export class ProvisionalBedNumberExtractor extends BedNumberExtractor {
  extract(message: string): string | null {
    const text = message.trim();

    return (AFTER_KEYWORD.exec(text) ?? ONLY_TOKEN.exec(text))?.[1] ?? null;
  }
}
