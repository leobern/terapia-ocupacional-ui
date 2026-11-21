import { Prescription, PrescriptionSaveRequest } from './prescription.models';

/**
 * Porta de leitura e gravação da prescrição vigente (FT-004-8). Sem contrato de API: a implementação real
 * substitui a provisória em `app.config.ts`. `load` devolve `null` sem prescrição; ambos rejeitam em caso
 * de falha. `save` substitui a anterior (última gravação prevalece, sem lock); autor e data/hora seguem
 * na requisição para a trilha de auditoria do backend.
 */
export abstract class PrescriptionSource {
  abstract load(patientId: string): Promise<Prescription | null>;
  abstract save(request: PrescriptionSaveRequest): Promise<Prescription>;
}
