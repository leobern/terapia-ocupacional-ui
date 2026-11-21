import { ActivePrescription, PrescriptionReview, PrescriptionReviewRequest } from './prescription.models';

/**
 * Porta da revisão diária da prescrição (FT-004-8, US-004-8-01). Sem contrato de API: a implementação real
 * substitui a provisória em `app.config.ts`; offline, `loadActive` e `loadReview` devolvem o último cache.
 * `loadActive` devolve `null` sem prescrição ativa; `loadReview` devolve `null` se o dia ainda não foi
 * revisado. `keep` só registra a revisão (autor e data/hora) e NUNCA altera a prescrição; a implementação
 * real recusa quem não for médico. Todos rejeitam em caso de falha. Última confirmação prevalece (sem lock).
 */
export abstract class PrescriptionSource {
  abstract loadActive(patientId: string): Promise<ActivePrescription | null>;
  abstract loadReview(patientId: string, day: string): Promise<PrescriptionReview | null>;
  abstract keep(request: PrescriptionReviewRequest): Promise<PrescriptionReview>;
}
