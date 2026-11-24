import { inject, Injectable } from '@angular/core';

import { MOVE_BED_ACTION_ID } from '../../../shared/services/assistant-action-router';
import { I18nService } from '../../../shared/services/i18n.service';
import {
  type ConversationOutcome,
  type ConversationParseResult,
  type ConversationStep,
  ConversationStepError,
  type ScreenAction,
} from '../../../shared/services/screen-actions.service';
import {
  BedMovementPort,
  BedNotIdentifiedError,
  PatientWithoutInternacaoError,
  type ResolvedBedMovement,
} from './bed-movement.port';
import { BedNumberExtractor } from './bed-number-extractor';

/**
 * Ação "Movimentar leito" do Hub (US-002-2-01): o paciente é o da tela, o leito vem da mensagem (ou da
 * resposta à pergunta) e o pedido é associado à internação mais recente. Confirma com Sim/Não antes de aplicar (US-002-2-03).
 */
@Injectable({ providedIn: 'root' })
export class MoveBedAction {
  private readonly i18n = inject(I18nService);
  private readonly port = inject(BedMovementPort);
  private readonly extractor = inject(BedNumberExtractor);

  build(patient: { readonly id: string; readonly name: string }): ScreenAction {
    const t = (key: string): string => this.i18n.t(`moveBed.${key}`);

    return {
      conversation: {
        errorMessage: t('messages.error'),
        seedFromMessage: message => this.extractor.extract(message) ?? '',
        skipLabel: '',
        steps: [
          {
            id: 'newBedNumber',
            // Vazio é aceito de propósito: quem decide MSG-12 (e a precedência de MSG-11) é o servidor.
            parse: raw => ({ value: this.extractor.extract(raw) ?? '' }),
            prompt: t('prompts.bedNumber'),
          },
        ],
        submit: values => this.submit(patient, values['newBedNumber'], t),
        successMessage: '',
        title: t('title'),
      },
      id: MOVE_BED_ACTION_ID,
      label: t('title'),
    };
  }

  private async submit(
    patient: { readonly id: string; readonly name: string },
    bed: string,
    t: (key: string) => string,
  ): Promise<ConversationOutcome> {
    // O contrato exige o id inteiro; id não numérico é falha genérica (mensagem de erro padrão do chat).
    if (!/^\d+$/.test(patient.id)) {
      throw new Error('Id de paciente não numérico');
    }
    try {
      const result = await this.port.resolve(Number(patient.id), bed);
      const summary = t('messages.summary')
        .replace('{patient}', patient.name)
        .replace('{current}', result.currentBedNumber ?? t('messages.noCurrentBed'))
        .replace('{new}', result.newBedNumber);

      // RN-01: nada é gravado aqui; só o "Sim" da etapa de confirmação aplica a mudança.
      return {
        confirmation: { step: this.confirmStep(t), submit: answer => this.decide(answer, patient, result, t) },
        message: summary,
        tone: 'success',
      };
    } catch (error) {
      return this.blocked(error, t);
    }
  }

  private confirmStep(t: (key: string) => string): ConversationStep {
    return {
      id: 'confirm',
      options: [
        { label: t('options.yes'), value: 'yes' },
        { label: t('options.no'), value: 'no' },
      ],
      parse: (raw): ConversationParseResult => {
        const answer = raw
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase();

        if (answer === 'sim' || answer === 'yes') {
          return { value: 'yes' };
        }

        return answer === 'nao' || answer === 'no' ? { value: 'no' } : { error: t('messages.confirmChoice') };
      },
      prompt: t('prompts.confirm'),
    };
  }

  /** RN-02 ("Sim" aplica) e RN-03 ("Não" cancela sem enviar nada). */
  private async decide(
    answer: string,
    patient: { readonly id: string; readonly name: string },
    result: ResolvedBedMovement,
    t: (key: string) => string,
  ): Promise<ConversationOutcome> {
    if (answer !== 'yes') {
      return {
        message: t('messages.cancelled').replace('{current}', result.currentBedNumber ?? t('messages.noCurrentBed')),
        tone: 'success',
      };
    }
    try {
      await this.port.confirm(result.pacienteId, result.internacaoId, result.newBedNumber);

      return { message: t('messages.applied').replace('{new}', result.newBedNumber), tone: 'success' };
    } catch (error) {
      if (error instanceof BedNotIdentifiedError) {
        // 422 MSG-12 na confirmação: volta a pedir o leito e refaz a resolução com o valor informado.
        return {
          confirmation: {
            step: {
              id: 'newBedNumber',
              parse: raw => ({ value: this.extractor.extract(raw) ?? '' }),
              prompt: t('prompts.bedNumber'),
            },
            submit: bed => this.submit(patient, bed, t),
          },
          message: error.message || t('messages.MSG-12'),
          tone: 'error',
        };
      }
      throw error;
    }
  }

  private blocked(error: unknown, t: (key: string) => string): ConversationOutcome {
    if (error instanceof PatientWithoutInternacaoError) {
      return { message: error.message || t('messages.MSG-11'), tone: 'error' };
    }
    if (error instanceof BedNotIdentifiedError) {
      throw new ConversationStepError('newBedNumber', error.message || t('messages.MSG-12'));
    }
    throw error;
  }
}
