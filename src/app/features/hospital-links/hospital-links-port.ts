import { HospitalLink, HospitalSearchPage } from './hospital-links.models';

/** Porta de dados da tela de vínculos (US-001-2-01). Erros chegam como `HttpErrorResponse`. */
export abstract class HospitalLinksPort {
  abstract search(name: string, cursor: string | null): Promise<HospitalSearchPage>;
  abstract list(): Promise<readonly HospitalLink[]>;
  abstract request(hospitalId: number): Promise<HospitalLink>;
}
