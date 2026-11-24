/** Chave de comparação de nomes: sem acentos, sem caixa e sem espaços repetidos (RN-02). */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll(/\s+/g, ' ')
    .trim();
}
