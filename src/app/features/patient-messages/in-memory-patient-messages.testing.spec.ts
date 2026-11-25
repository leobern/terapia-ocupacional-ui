import { InMemoryPatientMessages } from './in-memory-patient-messages.testing';
import { ProvisionalReplyTranscriber } from './provisional-reply-transcriber';

describe('InMemoryPatientMessages', () => {
  const req = {
    at: '2026-11-22T10:00:00.000Z',
    author: 'M',
    origin: 'text' as const,
    patientId: 'p1',
    text: 'oi',
    threadId: 'thread-1',
  };

  it('lista por paciente e por remetente', async () => {
    const s = new InMemoryPatientMessages();

    expect((await s.list('p1')).length).toBe(2);
    expect(await s.list('x')).toEqual([]);
    expect((await s.listBySender('Michelle Franklin')).length).toBe(1);
  });

  it('create cria uma thread ativa, sem respostas, lida por paciente e por remetente', async () => {
    const s = new InMemoryPatientMessages();
    const t = await s.create({
      at: req.at,
      author: 'Ana',
      patientId: 'p9',
      patientName: 'Maria',
      recipients: ['@Almira'],
      text: 'oi',
    });

    expect(t).toEqual(
      jasmine.objectContaining({ deadline: null, id: 'thread-3', replies: [], resolved: false, statusChanges: [] }),
    );

    expect((await s.list('p9')).length).toBe(1);
    expect((await s.listBySender('Ana')).length).toBe(1);
  });

  it('reply acrescenta a resposta sem reabrir thread ativa', async () => {
    const s = new InMemoryPatientMessages();
    const t = await s.reply(req);

    expect(t.replies.length).toBe(1);
    expect(t.statusChanges).toEqual([]);
  });

  it('resolve registra autor e data/hora, é idempotente e rejeita inexistente', async () => {
    const s = new InMemoryPatientMessages();
    const r = { at: req.at, author: 'M', patientId: 'p1', threadId: 'thread-1' };
    const t = await s.resolve(r);

    expect(t.resolved).toBeTrue();
    expect(t.statusChanges).toEqual([{ at: req.at, author: 'M', kind: 'resolved' }]);
    expect((await s.resolve(r)).statusChanges.length).toBe(1);
    expect((await s.listBySender('Michelle Franklin')).length).toBe(1);
    await expectAsync(s.resolve({ ...r, threadId: 'nada' })).toBeRejected();
  });

  it('resposta a thread resolvida reabre', async () => {
    const s = new InMemoryPatientMessages();

    await s.resolve({ at: req.at, author: 'M', patientId: 'p1', threadId: 'thread-1' });
    const t = await s.reply(req);

    expect(t.resolved).toBeFalse();
    expect(t.statusChanges.map(c => c.kind)).toEqual(['resolved', 'reopened']);
  });

  it('rejeita thread inexistente', async () => {
    await expectAsync(new InMemoryPatientMessages().reply({ ...req, threadId: 'nada' })).toBeRejected();
  });

  it('transcritor provisório não reconhece texto', async () => {
    expect(await new ProvisionalReplyTranscriber().transcribe()).toBe('');
  });
});
