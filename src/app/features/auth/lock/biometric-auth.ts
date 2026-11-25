/**
 * Porta da biometria do dispositivo (Face ID / impressão digital, RN-04). A implementação
 * nativa substitui `ProvisionalBiometricAuth` em `app.config.ts` quando houver shell móvel.
 */
export abstract class BiometricAuth {
  /** Há biometria configurada no dispositivo. */
  abstract isAvailable(): Promise<boolean>;
  /** Pede a biometria; `true` quando válida. Falha ou recusa devolve `false`. */
  abstract authenticate(): Promise<boolean>;
}
