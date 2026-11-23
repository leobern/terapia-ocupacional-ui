import {
  DirectedMessage,
  DirectedMessageRequest,
  Observation,
  ObservationRequest,
  ObservationSuggestions,
  ProfileGroup,
  RecipientsChangeRequest,
  Reevaluation,
  ReevaluationRequest,
  ResolveRequest,
  TeamMember,
} from './observation.models';

/** Registro de observação (mínimo da US-005-1-01, necessário como ponto de entrada das sugestões). */
export abstract class ObservationWriter {
  abstract save(request: ObservationRequest): Promise<Observation>;
}

/**
 * Porta da IA que sugere pendência de reavaliação e/ou comunicação. Rejeita quando a IA está indisponível:
 * nesse caso nenhuma sugestão é exibida e a observação segue registrada (FR-019).
 */
export abstract class ObservationSuggester {
  abstract suggest(text: string, authorGroup: ProfileGroup, today: string): Promise<ObservationSuggestions>;
}

/** Profissionais vinculados e aprovados a UM paciente (nunca todos do hospital com o perfil). */
export abstract class PatientTeamSource {
  abstract list(patientId: string): Promise<readonly TeamMember[]>;
}

export abstract class ReevaluationSource {
  abstract list(patientId: string): Promise<readonly Reevaluation[]>;
}

/** Gravação com trilha de auditoria (autor e data/hora); nada é editado nem apagado, só acrescentado. */
export abstract class ReevaluationWriter {
  abstract create(request: ReevaluationRequest): Promise<Reevaluation>;
  abstract changeRecipients(request: RecipientsChangeRequest): Promise<Reevaluation>;
  abstract resolve(request: ResolveRequest): Promise<Reevaluation>;
}

export abstract class DirectedMessageSource {
  abstract listMessages(patientId: string): Promise<readonly DirectedMessage[]>;
}

export abstract class DirectedMessageWriter {
  abstract send(request: DirectedMessageRequest): Promise<DirectedMessage>;
}
