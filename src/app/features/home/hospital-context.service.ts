import { computed, inject, Injectable, signal } from '@angular/core';

import { LinkedHospital, LinkedHospitalsReader } from './linked-hospitals';

/**
 * Hospital em contexto da Home. Os consumidores (contagem de pacientes e notificações)
 * reagem a `selected()`: cada mudança de valor significa recarregar apenas para aquele hospital.
 */
@Injectable({ providedIn: 'root' })
export class HospitalContextService {
  readonly hospitals: readonly LinkedHospital[] = inject(LinkedHospitalsReader).read();

  readonly selected = computed<LinkedHospital | null>(
    () => this.hospitals.find(h => h.id === this.selectedId()) ?? null,
  );
  readonly canSwitch = this.hospitals.length > 1;

  private readonly selectedId = signal<string | null>(this.hospitals[0]?.id ?? null);

  /** Troca o hospital em contexto. Ignora o já selecionado e ids sem vínculo. */
  select(id: string): void {
    if (id === this.selectedId() || !this.hospitals.some(h => h.id === id)) {
      return;
    }
    this.selectedId.set(id);
  }
}
