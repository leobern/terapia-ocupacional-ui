import { Injectable } from '@angular/core';

import { FormAssistant } from './form-assistant';
import { type FormValues } from './screen-actions.service';

/** Provisório (V1 sem IA): não preenche nada; o painel avisa e o usuário segue no cadastro manual. */
@Injectable()
export class ProvisionalFormAssistant extends FormAssistant {
  fill(): Promise<FormValues | null> {
    return Promise.resolve(null);
  }
}
