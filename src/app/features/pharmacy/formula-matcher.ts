import { Formula } from './formulas.models';

/** Um nome informado pelo gestor e as fórmulas do catálogo que podem ser ele (nenhuma = não encontrado). */
export interface FormulaMatch {
  readonly query: string;
  readonly candidates: readonly Formula[];
}

/** Palavras do pedido que não fazem parte do nome ("padronizar a fórmula X"). */
const IGNORED = new Set([
  'a',
  'as',
  'o',
  'os',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'formula',
  'formulas',
  'padronizar',
  'padronize',
]);

/** Sem acento, sem ®/™, vírgula decimal como ponto e pontuação como espaço. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .trim();
}

function words(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter(word => word !== '' && !IGNORED.has(word));
}

/** Um nome por linha, ponto e vírgula ou vírgula (a vírgula decimal de "1,5" não separa). */
export function splitFormulaNames(text: string): string[] {
  const names = text
    .split(/[\n;]+|,(?!\d)|(?<!\d),/)
    .map(name => name.trim())
    .filter(name => words(name).length > 0);

  return [...new Set(names)];
}

/** Número só vale inteiro ("1" não é "1.5"); palavra com 3+ letras vale pelo começo. */
function matchesWord(query: string, word: string): boolean {
  return word === query || (query.length >= 3 && !/\d/.test(query) && word.startsWith(query));
}

/** A fórmula tem todas as palavras informadas, no nome ou no fabricante. */
function hasAllWords(formula: Formula, wanted: readonly string[]): boolean {
  const known = words(`${formula.name} ${formula.manufacturer ?? ''}`);

  return wanted.every(part => known.some(word => matchesWord(part, word)));
}

/**
 * Procura cada nome no catálogo. Não é IA: compara o texto do nome e do fabricante. Nome idêntico devolve só ele;
 * senão, todas as fórmulas que têm todas as palavras informadas, para o gestor escolher.
 */
export function matchFormulas(text: string, formulas: readonly Formula[]): FormulaMatch[] {
  return splitFormulaNames(text).map(query => {
    const wanted = words(query);
    const exact = formulas.filter(formula => words(formula.name).join(' ') === wanted.join(' '));
    const candidates = exact.length > 0 ? exact : formulas.filter(formula => hasAllWords(formula, wanted));

    return { candidates, query };
  });
}

/** O que o catálogo já tem parecido com um pedido de inclusão (texto livre: nome, fabricante, características). */
export interface CatalogHits {
  /** Mesmo nome (com ou sem o fabricante): o pedido não faz sentido. */
  readonly exact: readonly Formula[];
  /** Nome parecido: pode ser outra versão, quem pede decide. */
  readonly similar: readonly Formula[];
}

function sameName(text: string, formulas: readonly Formula[]): Formula[] {
  const asked = words(text).join(' ');

  return formulas.filter(
    formula =>
      asked !== '' &&
      [formula.name, `${formula.name} ${formula.manufacturer ?? ''}`].some(known => words(known).join(' ') === asked),
  );
}

/** Tem todas as palavras do pedido, ou o pedido tem o nome inteiro dela mais alguma coisa. */
function closeNames(text: string, formulas: readonly Formula[]): Formula[] {
  const wanted = words(text);

  return formulas.filter(
    formula =>
      wanted.length > 0 && (hasAllWords(formula, wanted) || words(formula.name).every(word => wanted.includes(word))),
  );
}

export function findInCatalog(description: string, formulas: readonly Formula[]): CatalogHits {
  // Vários nomes no mesmo pedido (um por linha): cada um é conferido. Depois de uma vírgula também pode vir outro
  // nome, mas aí só o nome idêntico conta, para "Nome, fabricante" não virar alarme.
  const lines = description.split(/[\n;]+/);
  const parts = [...lines, ...description.split(/[\n;]+|,(?!\d)/)];
  const exact = new Set(parts.flatMap(part => sameName(part, formulas)));
  const similar = new Set(lines.flatMap(line => closeNames(line, formulas)).filter(formula => !exact.has(formula)));

  return { exact: [...exact], similar: [...similar] };
}
