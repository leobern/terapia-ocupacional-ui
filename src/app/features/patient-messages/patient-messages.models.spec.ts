import { formatDateTime, isOverdue, isThreadParticipant, MessageThread } from './patient-messages.models';

const base: MessageThread = {
  at: '2026-11-20T10:00:00.000Z',
  author: 'A',
  deadline: '2026-11-21T10:00:00.000Z',
  id: 't',
  patientId: 'p',
  patientName: 'Paciente',
  recipients: ['@todos'],
  replies: [],
  resolved: false,
  statusChanges: [],
  text: 'x',
};
const now = new Date('2026-11-22T10:00:00.000Z');

describe('patient-messages.models', () => {
  it('isOverdue: só pendência com prazo passado e não resolvida', () => {
    expect(isOverdue(base, now)).toBe(true);
    expect(isOverdue({ ...base, resolved: true }, now)).toBe(false);
    expect(isOverdue({ ...base, deadline: null }, now)).toBe(false);
    expect(isOverdue({ ...base, deadline: '2026-11-23T10:00:00.000Z' }, now)).toBe(false);
  });

  it('formatDateTime formata dd/MM/yyyy HH:mm', () => {
    expect(formatDateTime(new Date(2026, 10, 21, 9, 5).toISOString())).toBe('21/11/2026 09:05');
  });
});

describe('isThreadParticipant', () => {
  const t = {
    author: 'Ana',
    recipients: ['@medicos', '@Bruno'],
    replies: [{ author: 'Carla' }],
  } as unknown as MessageThread;

  it('remetente, mencionado pelo nome ou quem respondeu; grupo e estranho não', () => {
    expect(isThreadParticipant(t, 'Ana')).toBeTrue();
    expect(isThreadParticipant(t, 'bruno')).toBeTrue();
    expect(isThreadParticipant(t, 'Carla')).toBeTrue();
    expect(isThreadParticipant(t, 'Zé')).toBeFalse();
  });
});
