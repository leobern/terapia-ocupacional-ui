import { ProvisionalPatientListAiCommand } from './provisional-patient-list-ai-command';

describe('ProvisionalPatientListAiCommand', () => {
  it('aceita texto e áudio sem interpretar', async () => {
    const port = new ProvisionalPatientListAiCommand();

    await expectAsync(port.send({ kind: 'text', text: 'apenas NP' })).toBeResolved();
    await expectAsync(port.send({ audio: new Blob(['x']), kind: 'audio' })).toBeResolved();
  });
});
