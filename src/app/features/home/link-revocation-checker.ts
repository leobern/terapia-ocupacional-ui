/**
 * Confirma se o vínculo do profissional com um hospital foi revogado. O 403 dos endpoints de
 * hospital também significa "sem permissão" (ex.: não é gestor) e o `ErrorResponse` do contrato
 * só traz `message`, sem código, então a tela confirma aqui antes de mostrar "acesso revogado".
 */
export abstract class LinkRevocationChecker {
  /** `true` só quando o vínculo com o hospital consta como REVOGADO; qualquer falha resulta em `false`. */
  abstract isRevoked(hospitalId: number): Promise<boolean>;
}
