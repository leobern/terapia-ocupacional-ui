import {
  blockedMessage,
  entryForAll,
  entryForGroup,
  entryForPerson,
  formatRecordTime,
  isBlocked,
  LinkedProfessional,
  parseMentions,
  resolveRecipients,
} from './patient-message.models';

const TEAM: readonly LinkedProfessional[] = [
  { group: 'doctors', id: 1, name: 'Rafael Dutra', specialty: 'Nutrólogo' },
  { group: 'doctors', id: 4, name: 'Michelle Franklin', specialty: 'Nutróloga' },
  { group: 'nurses', id: 5, name: 'Almira Borges', specialty: 'Enfermeira' },
  { group: null, id: 9, name: 'José Árvore', specialty: 'Outro' },
];

describe('patient-message.models', () => {
  it('reconhece grupo por alias, sem diferenciar acento ou caixa, e resolve só os vinculados', () => {
    const [entry] = parseMentions('@Médicos, avaliar', TEAM);

    expect(entry.label).toBe('@medicos');
    expect(entry.origin).toBe('mention');
    expect(entry.members.map(m => m.id)).toEqual([1, 4]);
  });

  it('@todos resolve para todos os vinculados', () => {
    const [entry] = parseMentions('@todos atenção', TEAM);

    expect(entry.members.length).toBe(4);
  });

  it('reconhece pessoa pelo primeiro nome e ignora menção desconhecida ou repetida', () => {
    const entries = parseMentions('@almira @jose @almira @ninguem @fulano', TEAM);

    expect(entries.map(e => e.label)).toEqual(['Almira Borges', 'José Árvore']);
  });

  it('sem menção devolve lista vazia', () => {
    expect(parseMentions('dieta interrompida por tomografia', TEAM)).toEqual([]);
  });

  it('grupo sem profissional vinculado fica bloqueado, com aviso', () => {
    const [entry] = parseMentions('@fisio ajuda', TEAM);

    expect(isBlocked(entry)).toBeTrue();
    expect(blockedMessage(entry)).toBe('Nenhum profissional de @fisio está vinculado a este paciente.');
    expect(blockedMessage(entryForAll([], 'mention'))).toBe('Nenhum profissional está vinculado a este paciente.');
  });

  it('resolveRecipients une os membros sem repetir', () => {
    const recipients = resolveRecipients([
      entryForGroup('doctors', TEAM, 'ai'),
      entryForPerson(TEAM[0], 'mention'),
      entryForGroup('speech', TEAM, 'ai'),
    ]);

    expect(recipients.map(r => r.id)).toEqual([1, 4]);
  });

  it('formata data e hora', () => {
    expect(formatRecordTime(new Date(2026, 10, 3, 9, 5).toISOString())).toBe('03/11/2026 09:05');
  });
});
