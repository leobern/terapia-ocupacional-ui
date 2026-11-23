import { ProvisionalPatientMessages, ProvisionalReplyTranscriber } from './provisional-patient-messages';

describe('ProvisionalPatientMessages', () => {
  const req = {
    at: '2026-11-22T10:00:00.000Z',
    author: 'M',
    origin: 'text' as const,
    text: 'oi',
    threadId: 'thread-1',
  };

  it('lista por paciente e por remetente', async () => {
    const s = new ProvisionalPatientMessages();

    expect((await s.list('p1')).length).toBe(2);
    expect(await s.list('x')).toEqual([]);
    expect((await s.listBySender('Michelle Franklin')).length).toBe(1);
  });

  it('reply acrescenta a resposta sem reabrir thread ativa', async () => {
    const s = new ProvisionalPatientMessages();
    const t = await s.reply(req);

    expect(t.replies.length).toBe(1);
    expect(t.statusChanges).toEqual([]);
  });

  it('rejeita thread inexistente', async () => {
    await expectAsync(new ProvisionalPatientMessages().reply({ ...req, threadId: 'nada' })).toBeRejected();
  });

  it('transcritor provisório não reconhece texto', async () => {
    expect(await new ProvisionalReplyTranscriber().transcribe()).toBe('');
  });
});
