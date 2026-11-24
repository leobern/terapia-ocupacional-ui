import { TestBed } from '@angular/core/testing';

import { ProvisionalUserDirectory } from '../../../shared/services/provisional-user-directory';
import { UserDirectory } from '../../../shared/services/user-directory';
import { ProvisionalAnnouncementAssistant } from './provisional-announcement-assistant';

describe('ProvisionalAnnouncementAssistant', () => {
  let assistant: ProvisionalAnnouncementAssistant;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProvisionalAnnouncementAssistant, { provide: UserDirectory, useClass: ProvisionalUserDirectory }],
    });
    assistant = TestBed.inject(ProvisionalAnnouncementAssistant);
  });

  it('sugere o grupo por perfil provável a partir do conteúdo', async () => {
    const names = (await assistant.suggestRecipients('Estoque de medicamento baixo')).map(u => u.name);

    expect(names).toEqual(['farmaceuticos']);
  });

  it('não sugere nada quando o conteúdo não indica perfil', async () => {
    expect(await assistant.suggestRecipients('Bom dia a todos')).toEqual([]);
  });

  it('a transcrição ainda não existe: rejeita para cair na digitação manual', async () => {
    await expectAsync(assistant.transcribe(new Blob(['x']))).toBeRejected();
  });
});
