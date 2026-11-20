import { CensusPatient, PatientCard } from './patient-list.models';

function ageOn(birthDate: string, day: Date): number {
  const birth = new Date(`${birthDate}T00:00:00`);
  let age = day.getFullYear() - birth.getFullYear();

  if (day.getMonth() < birth.getMonth() || (day.getMonth() === birth.getMonth() && day.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

function daysBetween(start: string, day: Date): number {
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(day.getFullYear(), day.getMonth(), day.getDate());

  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

/**
 * Monta a worklist (FR-001/FR-002): só pacientes do hospital, cadastrados no Conductia e
 * admitidos pela EMTN; ordem padrão estável por ala e leito.
 */
export function assemblePatientList(
  census: readonly CensusPatient[],
  hospitalId: string,
  day: Date,
): readonly PatientCard[] {
  return census
    .filter(p => p.hospitalId === hospitalId && p.registeredInConductia && p.admissionStatus === 'ADMITTED_BY_EMTN')
    .map(p => ({
      adequacy: p.adequacy,
      age: ageOn(p.birthDate, day),
      bed: p.bed,
      finished: p.pendingTasks === 0,
      firstEvaluation: p.completedCycles === 0,
      id: p.id,
      name: p.name,
      therapy: p.therapy,
      therapyDays: daysBetween(p.therapyStartDate, day),
      ward: p.ward,
    }))
    .sort((a, b) => a.ward.localeCompare(b.ward, 'pt-BR') || a.bed.localeCompare(b.bed, 'pt-BR', { numeric: true }));
}
