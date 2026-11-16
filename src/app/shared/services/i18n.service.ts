import { Injectable } from '@angular/core';

import en from '../../../assets/i18n/en.json';
import ptBR from '../../../assets/i18n/pt-BR.json';

interface Dictionary {
  readonly [key: string]: string | Dictionary;
}

const DICTIONARIES: Readonly<Record<string, Dictionary>> = { en, 'pt-BR': ptBR };

/**
 * Tradução mínima sobre os JSON de `assets/i18n` (pt-BR é o padrão; `en` quando o
 * navegador reporta inglês). Chaves aninhadas em notação de ponto: `splash.logoLabel`.
 * Chave inexistente devolve a própria chave, tornando o erro visível em vez de silencioso.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly dictionary: Dictionary =
    typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')
      ? DICTIONARIES['en']
      : DICTIONARIES['pt-BR'];

  t(key: string): string {
    let node: string | Dictionary | undefined = this.dictionary;

    for (const part of key.split('.')) {
      node = typeof node === 'object' ? node[part] : undefined;
    }

    return typeof node === 'string' ? node : key;
  }
}
