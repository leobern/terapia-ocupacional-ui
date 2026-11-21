import {
  ActivePrescription,
  Prescription,
  PrescriptionReview,
  PrescriptionReviewRequest,
  PrescriptionSaveRequest,
} from './prescription.models';

/**
 * Porta da prescrição e da revisão diária (FT-004-8). Sem contrato de API: a implementação real substitui a
 * provisória em `app.config.ts`. Todos os métodos rejeitam em caso de falha.
 *
 * - `load`/`save`: prescrição vigente completa (US-004-8-02): uma entrada por via ativa (US-004-8-04). `load` devolve
 *   lista vazia sem prescrição; `save` substitui o conjunto anterior (última gravação prevalece, sem lock); autor e data/hora seguem na requisição.
 * - `loadActive`: projeção somente leitura da mesma prescrição para o resumo da revisão (US-004-8-01).
 * - `loadReview`/`keep`: registro da revisão do dia. `keep` só registra (autor e data/hora) e NUNCA altera a
 *   prescrição; a implementação real recusa quem não for médico. Offline, as leituras devolvem o último cache.
 */
export abstract class PrescriptionSource {
  abstract load(patientId: string): Promise<readonly Prescription[]>;
  abstract save(request: PrescriptionSaveRequest): Promise<readonly Prescription[]>;
  abstract loadActive(patientId: string): Promise<readonly ActivePrescription[]>;
  abstract loadReview(patientId: string, day: string): Promise<PrescriptionReview | null>;
  abstract keep(request: PrescriptionReviewRequest): Promise<PrescriptionReview>;
}
