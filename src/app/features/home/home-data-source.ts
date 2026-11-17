import { Injectable } from '@angular/core';

/** Dados da Home já carregados. O conteúdo (hospitais, cards) pertence a outras stories da feature. */
export type HomeData = Readonly<Record<string, unknown>>;

/**
 * Fonte de dados da Home, substituível em teste. Ainda não há API da Home no
 * repositório: a implementação padrão devolve dados vazios (provisórios) para a
 * tela abrir normalmente. A story de integração fornece a implementação real,
 * que rejeita quando o carregamento falha.
 */
@Injectable({ providedIn: 'root' })
export class HomeDataSource {
  load(): Promise<HomeData> {
    return Promise.resolve({});
  }
}
