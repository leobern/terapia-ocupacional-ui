import { inject, Injectable } from '@angular/core';

import { type DirectoryUser, UserDirectory } from '../../../shared/services/user-directory';
import { AnnouncementAssistant } from './announcement-assistant';

/** Palavras do conteúdo → grupo por perfil provável (regra simples até existir o motor de IA). */
const HINTS: readonly (readonly [RegExp, string])[] = [
  [/\b(dieta|nutri\w*|oral|enteral)\b/u, 'nutricionistas'],
  [/\b(medicament\w*|farmac\w*|estoque)\b/u, 'farmaceuticos'],
  [/\b(prescri\w*|conduta|exame)\b/u, 'medicos'],
  [/\b(curativo|sonda|enferm\w*)\b/u, 'enfermeiros'],
];

/** Provisória: sugestão por palavras-chave; a transcrição ainda não existe e sempre falha (digitação manual). */
@Injectable()
export class ProvisionalAnnouncementAssistant extends AnnouncementAssistant {
  private readonly directory = inject(UserDirectory);

  async suggestRecipients(content: string): Promise<readonly DirectoryUser[]> {
    const text = content
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
    const profiles = HINTS.filter(([pattern]) => pattern.test(text)).map(([, profile]) => profile);
    const groups = (await this.directory.search('')).filter(
      user => user.group?.profile && profiles.includes(user.name),
    );

    return groups;
  }

  transcribe(_: Blob): Promise<string> {
    return Promise.reject(new Error('Transcrição indisponível'));
  }
}
