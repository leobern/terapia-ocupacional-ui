import { HospitalLinkList } from './hospital-links.models';

/**
 * Fronteira de leitura dos vínculos do médico com hospitais (US-001-2-02).
 * Rejeita a promise quando o carregamento falha; a tela mostra o erro com "tentar novamente".
 */
export abstract class HospitalLinksSource {
  abstract list(): Promise<HospitalLinkList>;
}
