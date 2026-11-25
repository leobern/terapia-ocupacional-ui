import { inject, Injectable } from '@angular/core';

import { NOW } from '../home/professional-profile';
import { Shift, SHIFT_MAX_HOURS, ShiftStartRequest } from './shift.models';
import { ShiftSource } from './shift-source';

const STORAGE_KEY = 'conductia:shifts';
const HOUR_MS = 3_600_000;

/**
 * Provisório: guarda os turnos no `localStorage` (vale para as abas deste navegador; o backend real compartilha entre
 * aparelhos). Turno com mais de 14 horas deixa de valer. Iniciar de novo o turno do mesmo profissional substitui o anterior.
 */
@Injectable()
export class ProvisionalShiftSource extends ShiftSource {
  private readonly now = inject(NOW);

  listActive(hospitalId: number): Promise<readonly Shift[]> {
    return Promise.resolve(this.read().filter(s => s.hospitalId === hospitalId));
  }

  start(request: ShiftStartRequest): Promise<Shift> {
    const others = this.read().filter(
      s => !(s.hospitalId === request.hospitalId && s.professionalName === request.professionalName),
    );
    const shift: Shift = { ...request, id: `shift-${request.startedAt}-${others.length}`, patientIds: [] };

    this.write([...others, shift]);

    return Promise.resolve(shift);
  }

  selectPatients(shiftId: string, patientIds: readonly string[]): Promise<void> {
    this.write(this.read().map(s => (s.id === shiftId ? { ...s, patientIds } : s)));

    return Promise.resolve();
  }

  end(shiftId: string): Promise<void> {
    this.write(this.read().filter(s => s.id !== shiftId));

    return Promise.resolve();
  }

  private read(): readonly Shift[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw === null ? [] : (JSON.parse(raw) as Shift[]);
    const limit = this.now().getTime() - SHIFT_MAX_HOURS * HOUR_MS;

    return all.filter(s => new Date(s.startedAt).getTime() > limit);
  }

  private write(shifts: readonly Shift[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
  }
}
