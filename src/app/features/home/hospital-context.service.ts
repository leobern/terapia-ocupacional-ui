import { computed, inject, Injectable, signal } from '@angular/core';

import { HospitalSiteSource } from '../shift/hospital-site-source';
import { LinkedHospital, LinkedHospitalsReader } from './linked-hospitals';

export type HospitalsLoadStatus = 'loading' | 'success' | 'error';

/**
 * Hospital em contexto da Home. Os hospitais vêm do backend (assíncrono): `status` informa
 * carregando/erro/sucesso. Os consumidores (contagem de pacientes e notificações) reagem a
 * `selected()`: cada mudança de valor significa recarregar apenas para aquele hospital.
 */
@Injectable({ providedIn: 'root' })
export class HospitalContextService {
  readonly hospitals = signal<readonly LinkedHospital[]>([]);
  readonly status = signal<HospitalsLoadStatus>('loading');
  readonly selected = computed<LinkedHospital | null>(
    () => this.hospitals().find(h => h.id === this.selectedId()) ?? null,
  );
  /** RN-03 (US-003-1-03): com um único vínculo o seletor não oferece outras opções. */
  readonly canSwitch = computed(() => this.hospitals().length > 1);

  /** Hospital cujo acesso foi revogado nesta sessão (acesso negado pelo servidor); `null` = nenhum. */
  readonly revoked = signal<LinkedHospital | null>(null);

  private readonly reader = inject(LinkedHospitalsReader);
  private readonly sites = inject(HospitalSiteSource, { optional: true });
  private readonly selectedId = signal<number | null>(null);
  private generation = 0;

  constructor() {
    // Dispara o carregamento já na criação; `status` informa o andamento (a Home mostra o skeleton).
    // eslint-disable-next-line sonarjs/no-async-constructor
    void this.load();
  }

  /** (Re)carrega os hospitais vinculados; mantém o hospital escolhido se ele ainda existir. */
  async load(): Promise<void> {
    const generation = ++this.generation;

    this.status.set('loading');
    try {
      const linked = await this.reader.read();
      // Hospitais criados em "Cadastrar hospital" (provisório) somam-se aos vínculos do backend.
      const local = (await this.sites?.listLocalHospitals().catch((): readonly LinkedHospital[] => [])) ?? [];
      const hospitals = [...linked, ...local.filter(l => !linked.some(h => h.id === l.id))];

      if (generation !== this.generation) {
        return;
      }
      this.hospitals.set(hospitals);
      this.revoked.set(null);
      if (!hospitals.some(h => h.id === this.selectedId())) {
        this.selectedId.set(hospitals[0]?.id ?? null);
      }
      this.status.set('success');
    } catch {
      if (generation === this.generation) {
        this.status.set('error');
      }
    }
  }

  /**
   * Trata o acesso negado como revogação (US-001-2-04, RN01): tira o hospital das opções na hora,
   * sem esperar novo login. Se era o selecionado, o contexto passa ao primeiro vínculo ativo restante
   * ou ao estado sem hospital.
   */
  revokeAccess(id: number): void {
    const hospital = this.hospitals().find(h => h.id === id);

    if (hospital === undefined) {
      return;
    }
    const remaining = this.hospitals().filter(h => h.id !== id);

    this.revoked.set(hospital);
    this.hospitals.set(remaining);
    if (this.selectedId() === id) {
      this.selectedId.set(remaining[0]?.id ?? null);
    }
  }

  /** Inclui um hospital recém-cadastrado e o seleciona (a lista seguinte já o traz do cadastro local). */
  addLocal(hospital: LinkedHospital): void {
    if (!this.hospitals().some(h => h.id === hospital.id)) {
      this.hospitals.set([...this.hospitals(), hospital]);
    }
    this.selectedId.set(hospital.id);
  }

  /** Troca o hospital em contexto. Ignora o já selecionado e ids sem vínculo. */
  select(id: number): void {
    if (id === this.selectedId() || !this.hospitals().some(h => h.id === id)) {
      return;
    }
    this.selectedId.set(id);
  }
}
