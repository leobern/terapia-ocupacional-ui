/** Vias de nutrição individuais; a vigente pode combinar várias em uso simultâneo (FR-003a). */
export type NutritionRoute = 'VO' | 'NE' | 'NP';

/** Ordem padronizada de exibição das combinações (ex.: "VO/NE"). */
export const NUTRITION_ROUTES: readonly { readonly id: NutritionRoute; readonly label: string }[] = [
  { id: 'VO', label: 'Via oral' },
  { id: 'NE', label: 'Nutrição enteral' },
  { id: 'NP', label: 'Nutrição parenteral' },
];

/** Via vigente do paciente e desde quando vale. */
export interface CurrentRoute {
  readonly routes: readonly NutritionRoute[];
  /** ISO de quando a via passou a valer. */
  readonly since: string;
}

export interface RouteSaveRequest {
  readonly at: string;
  readonly author: string;
  readonly patientId: string;
  readonly routes: readonly NutritionRoute[];
}

/** Remove duplicatas e ordena na ordem padronizada (VO, NE, NP). */
export function normalizeRoutes(routes: readonly NutritionRoute[]): NutritionRoute[] {
  return NUTRITION_ROUTES.map(r => r.id).filter(id => routes.includes(id));
}

/** Texto da via vigente: "NE", "VO/NE"… */
export function routeLabel(routes: readonly NutritionRoute[]): string {
  return normalizeRoutes(routes).join('/');
}

/** Decisão do médico sobre a necessidade de avaliação de deglutição (sem encaminhamento automático). */
export type SwallowingDecision = 'needed' | 'not-needed';

export const SWALLOWING_OPTIONS: readonly { readonly id: SwallowingDecision; readonly label: string }[] = [
  { id: 'needed', label: 'Necessária' },
  { id: 'not-needed', label: 'Não necessária' },
];

export interface SwallowingSaveRequest {
  readonly at: string;
  readonly author: string;
  readonly decision: SwallowingDecision;
  readonly patientId: string;
}

/** Texto da decisão; vazio quando ainda não há decisão. */
export function swallowingLabel(decision: SwallowingDecision | null): string {
  return SWALLOWING_OPTIONS.find(o => o.id === decision)?.label ?? '';
}
