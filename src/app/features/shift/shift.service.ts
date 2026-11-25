import { computed, inject, Injectable, signal } from '@angular/core';

import { distanceMeters, GeolocationError, GeolocationService } from '../../shared/services/geolocation.service';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import { HospitalSiteSource } from './hospital-site-source';
import { Shift } from './shift.models';
import { ShiftSource } from './shift-source';

export type ShiftStartFailure = 'denied' | 'error' | 'no-site' | 'outside' | 'timeout' | 'unavailable' | 'unsupported';

export interface ShiftStartResult {
  readonly ok: boolean;
  readonly shift?: Shift;
  readonly reason?: ShiftStartFailure;
  /** Distância até o hospital (metros), quando a posição foi lida. */
  readonly distanceMeters?: number;
  readonly radiusMeters?: number;
}

/** Texto de distância: metros até 1 km, depois quilômetros. */
function distanceText(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
    : `${Math.round(meters)} m`;
}

/** Orientação em texto para cada motivo de falha ao iniciar o turno (a cor nunca é o único sinal). */
export function shiftFailureMessage(result: ShiftStartResult): string {
  switch (result.reason) {
    case 'no-site':
      return 'Este hospital ainda não tem localização cadastrada. Use "Cadastrar hospital" para informar a localização.';
    case 'outside':
      return `Você está a ${distanceText(result.distanceMeters ?? 0)} do hospital. Para iniciar o turno, chegue a até ${result.radiusMeters ?? 0} m dele.`;
    case 'denied':
      return 'Sem acesso à localização. Permita a localização no navegador para iniciar o turno.';
    case 'timeout':
      return 'Não foi possível obter a sua localização a tempo. Tente de novo.';
    case 'unsupported':
      return 'Este aparelho não oferece geolocalização.';
    default:
      return 'Não foi possível iniciar o turno. Tente de novo em instantes.';
  }
}

/**
 * Turno de trabalho (Thiago, 2026-11-25): ao chegar ao hospital (dentro do raio cadastrado) o profissional inicia o turno
 * e escolhe os pacientes que vai visitar; os outros profissionais do hospital veem quem já está em turno.
 */
@Injectable({ providedIn: 'root' })
export class ShiftService {
  /** Turnos em andamento do hospital em contexto (todos os profissionais). */
  readonly shifts = signal<readonly Shift[]>([]);
  readonly mine = computed(() => this.shifts().find(s => s.professionalName === this.profile.read().name) ?? null);
  readonly others = computed(() => this.shifts().filter(s => s.professionalName !== this.profile.read().name));
  /** Pacientes escolhidos por outros profissionais: id do paciente → nome de quem vai visitar. */
  readonly takenBy = computed(() => {
    const map = new Map<string, string>();

    for (const shift of this.others()) {
      for (const id of shift.patientIds) {
        map.set(id, shift.professionalName);
      }
    }

    return map;
  });

  private readonly shiftSource = inject(ShiftSource);
  private readonly siteSource = inject(HospitalSiteSource);
  private readonly geolocation = inject(GeolocationService);
  private readonly profile = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  private hospitalId: number | null = null;

  /** Lê os turnos em andamento do hospital; falha mantém o que já está. */
  async refresh(hospitalId: number): Promise<void> {
    this.hospitalId = hospitalId;
    try {
      this.shifts.set(await this.shiftSource.listActive(hospitalId));
    } catch {
      // mantém os turnos já exibidos
    }
  }

  /** Inicia o turno só se o profissional está dentro do raio do hospital. */
  async start(hospitalId: number): Promise<ShiftStartResult> {
    try {
      const site = await this.siteSource.load(hospitalId);

      if (site === null) {
        return { ok: false, reason: 'no-site' };
      }
      const position = await this.geolocation.locate();
      const distance = distanceMeters(position, site);

      if (distance > site.radiusMeters) {
        return { distanceMeters: distance, ok: false, radiusMeters: site.radiusMeters, reason: 'outside' };
      }
      const me = this.profile.read();
      const shift = await this.shiftSource.start({
        hospitalId,
        professionalName: me.name,
        professionalRole: me.role === 'doctor' ? 'Médico' : 'Equipe multiprofissional',
        startedAt: this.now().toISOString(),
      });

      await this.refresh(hospitalId);

      return { ok: true, shift };
    } catch (failure) {
      return { ok: false, reason: failure instanceof GeolocationError ? failure.reason : 'error' };
    }
  }

  /** Grava os pacientes que o profissional vai visitar neste turno. */
  async savePatients(patientIds: readonly string[]): Promise<void> {
    const shift = this.mine();

    if (shift === null || this.hospitalId === null) {
      return;
    }
    await this.shiftSource.selectPatients(shift.id, patientIds);
    await this.refresh(this.hospitalId);
  }

  /** Encerra o turno do profissional. */
  async end(): Promise<void> {
    const shift = this.mine();

    if (shift === null || this.hospitalId === null) {
      return;
    }
    await this.shiftSource.end(shift.id);
    await this.refresh(this.hospitalId);
  }
}
