import { MessageThread } from './patient-messages.models';
import { sentThreadStatusText, sentThreadToNotification } from './sent-thread-notification';

const thread: MessageThread = {
  at: '2026-11-20T10:00:00.000Z',
  author: 'Michelle Franklin',
  deadline: null,
  id: 'thread-7',
  patientId: 'p1',
  patientName: 'Lucas',
  recipients: ['@todos'],
  replies: [],
  resolved: false,
  statusChanges: [],
  text: 'Oi',
};
const reply = { at: '2026-11-20T11:00:00.000Z', author: 'Ana', id: 'r1', origin: 'text' as const, text: 'ok' };

describe('sent-thread-notification', () => {
  it('texto de estado: ativa/resolvida e quantidade de respostas', () => {
    expect(sentThreadStatusText(thread)).toBe('Ativa · sem resposta');
    expect(sentThreadStatusText({ ...thread, replies: [reply] })).toBe('Ativa · 1 resposta');
    expect(sentThreadStatusText({ ...thread, replies: [reply, reply], resolved: true })).toBe(
      'Resolvida · 2 respostas',
    );
  });

  it('converte a thread em notificação com paciente, resumo, estado e respostas', () => {
    const n = sentThreadToNotification({ ...thread, replies: [reply] });

    expect(n.id).toBe(-7);
    expect(n.patient).toEqual({ id: 'p1', name: 'Lucas' });
    expect(n.description).toBe('Ativa · 1 resposta — Oi');
    expect(n.replyCount).toBe(1);
    expect(n.replies[0].text).toBe('ok');
  });
});
