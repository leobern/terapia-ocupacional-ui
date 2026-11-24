import { inject, Injectable } from '@angular/core';

import { MOVE_BED_ACTION_ID } from '../../../shared/services/assistant-action-router';
import { I18nService } from '../../../shared/services/i18n.service';
import {
  type ConversationOutcome,
  ConversationStepError,
  type ScreenAction,
} from '../../../shared/services/screen-actions.service';
import { BedMovementPort, BedNotIdentifiedError, PatientWithoutInternacaoError } from './bed-movement.port';
import { BedNumberExtractor } from './bed-number-extractor';

/**
 * Ação "Movimentar leito" do Hub (US-002-2-01): o paciente é o da tela, o leito vem da mensagem (ou da
 * resposta à pergunta) e o pedido é associado à internação mais recente. Não grava nada (US-002-2-03).
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
      const text = t('messages.resolved')
        .replace('{patient}', patient.name)
        .replace('{current}', result.currentBedNumber ?? t('messages.noCurrentBed'))
        .replace('{new}', result.newBedNumber);

      return { message: text, tone: 'success' };
    } catch (error) {
      if (error instanceof PatientWithoutInternacaoError) {
        return { message: error.message || t('messages.MSG-11'), tone: 'error' };
      }
      if (error instanceof BedNotIdentifiedError) {
        throw new ConversationStepError('newBedNumber', error.message || t('messages.MSG-12'));
      }
      throw error;
    }
  }
}
