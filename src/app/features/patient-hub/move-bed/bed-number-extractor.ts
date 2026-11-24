/**
 * Fronteira que extrai o leito de uma mensagem livre ("mudar para o leito 412"). A extração por linguagem
 * natural é do motor de IA (fora de escopo); o provisório abaixo é substituível sem tocar na ação.
 */
export abstract class BedNumberExtractor {
  /** Leito identificado ou `null` quando a mensagem não traz um. */
  abstract extract(message: string): string | null;
}
