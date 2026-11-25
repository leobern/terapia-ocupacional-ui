/**
 * Fronteira que extrai o nome do paciente de uma mensagem livre ("mover Beatriz Ramos Costa para o leito 210").
 * A extração por linguagem natural é do motor de IA (fora de escopo); o provisório é substituível sem tocar na ação.
 */
export abstract class PatientNameExtractor {
  /** Nome identificado ou `null` quando a mensagem não traz um. */
  abstract extract(message: string): string | null;
}
