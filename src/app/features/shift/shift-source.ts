import { Shift, ShiftStartRequest } from './shift.models';

/**
 * Porta dos turnos de trabalho do hospital. Sem contrato de API: a implementação real (backend) substitui a
 * provisória em `app.config.ts`. `listActive` devolve os turnos em andamento de TODOS os profissionais do hospital
 * (é assim que um médico vê quem já está trabalhando). Rejeita em caso de falha.
 */
export abstract class ShiftSource {
  abstract listActive(hospitalId: number): Promise<readonly Shift[]>;
  abstract start(request: ShiftStartRequest): Promise<Shift>;
  abstract selectPatients(shiftId: string, patientIds: readonly string[]): Promise<void>;
  abstract end(shiftId: string): Promise<void>;
}
