import { HospitalLink, HospitalLinkList, HospitalSearchPage } from './hospital-links.models';

/**
 * Fronteira de dados dos vínculos do médico com hospitais (US-001-2-01 e US-001-2-02).
 * Rejeita a promise em caso de falha; erros HTTP chegam como `HttpErrorResponse`
 * e a tela mostra o aviso (com "tentar novamente" na listagem).
 */
export abstract class HospitalLinksSource {
  abstract list(): Promise<HospitalLinkList>;
  abstract search(name: string, cursor: string | null): Promise<HospitalSearchPage>;
  abstract request(hospitalId: number): Promise<HospitalLink>;
}
