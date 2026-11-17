import { InjectionToken } from '@angular/core';

/** Dados do profissional autenticado exibidos no cabeçalho da Home. */
export interface ProfessionalProfile {
  readonly name: string;
  /** Ausente quando o profissional não tem foto: o avatar cai nas iniciais. */
  readonly photoUrl?: string;
}

/**
 * Fronteira de leitura do perfil autenticado.
 *
 * DEPENDÊNCIA: a fonte real do perfil pertence a outra story e substituirá
 * `LocalProfessionalProfileReader` em `app.config.ts`.
 */
export abstract class ProfessionalProfileReader {
  abstract read(): ProfessionalProfile;
}

/** Fonte de tempo injetável (testável com data fixa). */
export const NOW = new InjectionToken<() => Date>('NOW', { factory: (): (() => Date) => (): Date => new Date() });
