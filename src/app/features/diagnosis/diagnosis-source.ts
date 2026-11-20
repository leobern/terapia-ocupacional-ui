import { GlimReading } from './diagnosis.models';

/**
 * Porta de leitura dos dados da Avaliação Nutricional e Funcional (FT-004-4) já classificados nos 5
 * critérios do GLIM. Sem contrato de API nem cortes clínicos validados: a implementação real substitui a
 * provisória em `app.config.ts`. Offline, devolve a cópia local do último cálculo, se existir; rejeita
 * quando a leitura falha.
 */
export abstract class DiagnosisSource {
  abstract load(patientId: string): Promise<GlimReading>;
}
