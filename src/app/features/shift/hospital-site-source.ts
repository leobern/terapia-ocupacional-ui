import { LinkedHospital } from '../home/linked-hospitals';
import { HospitalSite } from './shift.models';

/**
 * Porta de leitura e gravação da localização do hospital (latitude, longitude e raio) usada na geolocalização do
 * turno. Sem contrato de API: a implementação real (backend) substitui a provisória em `app.config.ts`.
 * `load` devolve `null` quando o hospital ainda não tem localização; ambos rejeitam em caso de falha.
 */
export abstract class HospitalSiteSource {
  abstract load(hospitalId: number): Promise<HospitalSite | null>;
  abstract save(site: HospitalSite): Promise<void>;
  /** Hospitais criados no cadastro local (provisório): somam-se aos vínculos vindos do backend. */
  abstract listLocalHospitals(): Promise<readonly LinkedHospital[]>;
}
