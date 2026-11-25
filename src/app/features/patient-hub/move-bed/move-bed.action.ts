import { inject, Injectable, Injector } from '@angular/core';

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
  type PatientCandidate,
  PatientNotFoundError,
  PatientWithoutInternacaoError,
  type ResolvedBedMovement,
} from './bed-movement.port';
import { BedNumberExtractor } from './bed-number-extractor';
import { PatientNameExtractor } from './patient-name-extractor';

/**
 * Ação "Movimentar leito" do Hub (US-002-2-01): o paciente é o da tela, o leito vem da mensagem (ou da
 * resposta à pergunta) e o pedido é associado à internação mais recente. Confirma com Sim/Não antes de aplicar (US-002-2-03).
 */
@Injectable({ providedIn: 'root' })
export class MoveBedAction {
  private readonly i18n = inject(I18nService);
  private readonly port = inject(BedMovementPort);
  private readonly extractor = inject(BedNumberExtractor);
  private readonly injector = inject(Injector);

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

  /**
   * US-002-2-02: pedido fora da tela do paciente. O nome vem da mensagem (ou da resposta à pergunta), o leito
   * também; a busca é restrita ao hospital ativo. Vários pacientes: lista e pede a escolha; um: segue o fluxo normal.
   */
  buildByName(activeHospitalId: () => number | undefined): ScreenAction {
    const t = (key: string): string => this.i18n.t(`moveBed.${key}`);
    const bedOf = (raw: string): string => this.extractor.extract(raw) ?? '';

    return {
      conversation: {
        errorMessage: t('messages.error'),
        // O pedido inteiro é a resposta da etapa do nome; o leito extraído viaja junto com ele.
        seedFromMessage: message => message,
        skipLabel: '',
        steps: [
          {
            id: 'request',
            parse: (raw): ConversationParseResult => {
              const name =
                this.injector.get(PatientNameExtractor).extract(raw) ??
                (/^[\p{L}'’. -]+$/u.test(raw) ? raw.trim() : '');

              return name ? { value: JSON.stringify({ bed: bedOf(raw), name }) } : { error: t('messages.nameMissing') };
            },
            prompt: t('prompts.patientName'),
          },
          // Só é perguntada quando o servidor devolve MSG-12 (ConversationStepError); por isso nunca entra no fluxo normal.
          {
            id: 'newBedNumber',
            parse: raw => ({ value: bedOf(raw) }),
            prompt: t('prompts.bedNumber'),
            when: () => false,
          },
        ],
        submit: values => this.submitByName(activeHospitalId(), values, t),
        successMessage: '',
        title: t('title'),
      },
      id: MOVE_BED_ACTION_ID,
      label: t('title'),
    };
  }

  private async submitByName(
    hospitalId: number | undefined,
    values: Readonly<Record<string, string>>,
    t: (key: string) => string,
  ): Promise<ConversationOutcome> {
    if (hospitalId === undefined) {
      throw new Error('Sem hospital ativo');
    }
    const request = JSON.parse(values['request']) as { bed: string; name: string };
    const bed = values['newBedNumber'] ?? request.bed;

    try {
      const found = await this.port.resolveByName(hospitalId, request.name, bed);

      return found.kind === 'single'
        ? this.present({ id: String(found.resolved.pacienteId), name: request.name }, found.resolved, t)
        : this.askWhich(found.candidates, bed, t);
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        return { message: error.message || t('messages.MSG-13'), tone: 'error' };
      }

      return this.blocked(error, t);
    }
  }

  /** RN-03: lista nome, data de nascimento e SAME e pede a escolha; ao escolher, resolve pelo id do escolhido. */
  private askWhich(
    candidates: readonly PatientCandidate[],
    bed: string,
    t: (key: string) => string,
  ): ConversationOutcome {
    const labels = candidates.map(
      (c, i) =>
        `${i + 1}. ${c.fullName} — ${t('messages.birth')} ${c.birthDate.split('-').reverse().join('/')} — ${t('messages.same')} ${c.medicalRecordNumber ?? t('messages.noSame')}`,
    );
    const pick = (raw: string): PatientCandidate | undefined => {
      const text = raw.trim();

      return candidates.find((_, i) => text === String(i + 1) || text === labels[i]);
    };

    return {
      confirmation: {
        step: {
          id: 'candidate',
          options: labels.map((label, i) => ({ label, value: String(i + 1) })),
          parse: raw => (pick(raw) ? { value: raw.trim() } : { error: t('messages.chooseInvalid') }),
          prompt: t('prompts.chooseOne'),
        },
        submit: async (answer): Promise<ConversationOutcome> => {
          const chosen = pick(answer) as PatientCandidate;

          try {
            return this.present(
              { id: String(chosen.id), name: chosen.fullName },
              await this.port.resolve(chosen.id, bed),
              t,
            );
          } catch (error) {
            return error instanceof BedNotIdentifiedError
              ? this.askBedAgain({ id: String(chosen.id), name: chosen.fullName }, error, t)
              : this.blocked(error, t);
          }
        },
      },
      message: `${t('messages.multiple')}\n${labels.join('\n')}`,
      tone: 'success',
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
      return this.present(patient, await this.port.resolve(Number(patient.id), bed), t);
    } catch (error) {
      return this.blocked(error, t);
    }
  }

  /** Resumo da alteração e pedido de confirmação Sim/Não (RN-01: nada é gravado aqui). */
  private present(
    patient: { readonly id: string; readonly name: string },
    result: ResolvedBedMovement,
    t: (key: string) => string,
  ): ConversationOutcome {
    const summary = t('messages.summary')
      .replace('{patient}', patient.name)
      .replace('{current}', result.currentBedNumber ?? t('messages.noCurrentBed'))
      .replace('{new}', result.newBedNumber);

    return {
      confirmation: { step: this.confirmStep(t), submit: answer => this.decide(answer, patient, result, t) },
      message: summary,
      tone: 'success',
    };
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
        return this.askBedAgain(patient, error, t);
      }
      throw error;
    }
  }

  /** 422 MSG-12 depois da resolução/confirmação: volta a pedir o leito e refaz a resolução com o valor informado. */
  private askBedAgain(
    patient: { readonly id: string; readonly name: string },
    error: BedNotIdentifiedError,
    t: (key: string) => string,
  ): ConversationOutcome {
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
