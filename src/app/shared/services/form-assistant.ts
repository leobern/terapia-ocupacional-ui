import { type FormActionDefinition, type FormValues } from './screen-actions.service';

/** O que o usuário disse para preencher um cadastro: texto em linguagem natural ou o áudio gravado. */
export interface FormAssistInput {
  readonly text?: string;
  readonly audio?: Blob;
}

/**
 * Porta do preenchimento de cadastro por IA (texto ou áudio em linguagem natural → valores dos campos). A IA só
 * PREENCHE o formulário, que o usuário revisa e envia; o cadastro manual sempre existe (sem IA ou sem internet).
 * Devolver `null` (ou rejeitar) = a IA não conseguiu: o formulário fica como está e o painel avisa.
 */
export abstract class FormAssistant {
  abstract fill(form: FormActionDefinition, input: FormAssistInput): Promise<FormValues | null>;
}
