import { type ScreenAction } from './screen-actions.service';

/** Ação já especificada que uma mensagem do usuário pode pedir (FT-002-1 e FT-002-2). */
export interface KnownAssistantAction {
  /** Mesmo `id` com que a tela registra a ação em `ScreenActionsService`. */
  readonly id: string;
  readonly label: string;
  readonly matches: (normalizedMessage: string) => boolean;
}

export const REGISTER_PATIENT_ACTION_ID = 'register-patient';
export const MOVE_BED_ACTION_ID = 'move-bed';
export const LOCATION_ACTION_ID = 'change-location';

const REGISTER_PATIENT = /\b(cadastr\w*|registr\w*|criar|adicionar|incluir)\b.*\bpaciente\b/;
const MOVE_BED = /\b(mov\w+|trocar|transferir|mudar|mudanca|alterar)\b.*\bleito\b|\bmudar\b.*\b(coisa|aqui|algo)\b/;
const CHANGE_LOCATION = /\b(unidade|ala)\b/;

/** Ações conhecidas, em ordem de prioridade. Roteamento simples e substituível pelo motor de IA. */
export const KNOWN_ASSISTANT_ACTIONS: readonly KnownAssistantAction[] = [
  { id: MOVE_BED_ACTION_ID, label: 'Movimentar leito', matches: m => MOVE_BED.test(m) },
  { id: LOCATION_ACTION_ID, label: 'Alterar unidade/ala', matches: m => CHANGE_LOCATION.test(m) },
  { id: REGISTER_PATIENT_ACTION_ID, label: 'Cadastrar paciente', matches: m => REGISTER_PATIENT.test(m) },
];

function normalize(message: string): string {
  return message.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Devolve a ação conhecida pedida pela mensagem, ou `null` se não houver correspondência única. */
export function recognizeAction(message: string): KnownAssistantAction | null {
  const text = normalize(message);
  const found = KNOWN_ASSISTANT_ACTIONS.filter(action => action.matches(text));

  return found.length === 1 ? found[0] : null;
}

/** Ação a abrir: a registrada pela tela (mesma definição do atalho) ou um aviso de indisponível. */
export function resolveAction(known: KnownAssistantAction, registered: readonly ScreenAction[]): ScreenAction {
  return registered.find(a => a.id === known.id) ?? { id: known.id, label: known.label };
}
