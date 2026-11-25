/** Raio padrão (metros) em volta do hospital em que o profissional pode iniciar o turno. */
export const DEFAULT_RADIUS_METERS = 300;

/** Localização do hospital cadastrada para a geolocalização do turno. */
export interface HospitalSite {
  readonly hospitalId: number;
  /** Nome do hospital cadastrado por aqui (hospital local, ainda sem registro no backend). */
  readonly name?: string;
  /** `true` = hospital criado no cadastro local (provisório): entra na lista de hospitais do profissional. */
  readonly local?: boolean;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly radiusMeters: number;
}

/**
 * Turno de trabalho: o profissional chegou ao hospital (dentro do raio) e escolheu os pacientes que vai visitar.
 * Outros profissionais veem quem já está em turno e quais pacientes cada um escolheu (equipe multidisciplinar).
 */
export interface Shift {
  readonly id: string;
  readonly hospitalId: number;
  readonly professionalName: string;
  readonly professionalRole: string;
  /** ISO 8601 */
  readonly startedAt: string;
  readonly patientIds: readonly string[];
}

/** Dados para iniciar um turno. */
export interface ShiftStartRequest {
  readonly hospitalId: number;
  readonly professionalName: string;
  readonly professionalRole: string;
  /** ISO 8601 */
  readonly startedAt: string;
}

/** Um turno vale até 14 horas depois do início (provisório: o backend decide quando encerra). */
export const SHIFT_MAX_HOURS = 14;
