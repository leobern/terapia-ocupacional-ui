import { type ScreenCommand } from '../../shared/services/screen-actions.service';

/**
 * Porta da camada de IA de filtro/ordenação (FT-003-4). A lista só encaminha o comando (texto ou
 * áudio como gravado); interpretar e aplicar é da FT-003-4. Rejeitar = IA indisponível.
 * A implementação real substitui a provisória em `app.config.ts`.
 */
export abstract class PatientListAiCommandPort {
  abstract send(command: ScreenCommand): Promise<void>;
}
