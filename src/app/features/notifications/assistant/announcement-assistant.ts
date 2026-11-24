import { type DirectoryUser } from '../../../shared/services/user-directory';

/**
 * Porta da camada de IA do comunicado interno (FT-003-4): sugere destinatários a partir do
 * conteúdo e transcreve o áudio ditado. Rejeitar = IA indisponível: o fluxo manual segue
 * funcionando. A implementação real substitui a provisória em `app.config.ts`.
 */
export abstract class AnnouncementAssistant {
  /** Destinatários (pessoas ou grupos) prováveis para o conteúdo; nunca valem sem confirmação explícita. */
  abstract suggestRecipients(content: string): Promise<readonly DirectoryUser[]>;
  /** Texto transcrito do áudio ditado. */
  abstract transcribe(audio: Blob): Promise<string>;
}
