import {
  ProvisionalObservationStore,
  ProvisionalObservationSuggester,
  ProvisionalPatientTeamSource,
} from './provisional-observation';

describe('provisional observation', () => {
  const suggester = new ProvisionalObservationSuggester();

  it('sugere pendência para acompanhamento, com prazo no dia seguinte', async () => {
    const result = await suggester.suggest('Diarreia há 48 horas', 'medicos', '2026-11-30');

    expect(result.reevaluation).toEqual({ dueDate: '2026-12-01', reason: 'Diarreia há 48 horas' });
    expect(result.communication).toBeNull();
  });

  it('sugere comunicação com rascunho acionável', async () => {
    const result = await suggester.suggest('Erosão da mucosa nasolabial', 'medicos', '2026-11-23');

    expect(result.communication?.group).toBe('enfermagem');
    expect(result.communication?.draft).toContain('Solicito');
    expect(result.reevaluation).toBeNull();
  });

  it('não sugere nada para observação neutra', async () => {
    expect(await suggester.suggest('Dieta interrompida para tomografia', 'nutris', '2026-11-23')).toEqual({
      communication: null,
      reevaluation: null,
    });
  });

  it('equipe provisória não tem @fisio', async () => {
    const team = await new ProvisionalPatientTeamSource().list();

    expect(team.some(m => m.group === 'fisio')).toBeFalse();
    expect(team.some(m => m.group === 'medicos')).toBeTrue();
  });

  it('guarda observação, pendência (com trilha de alterações e resolução) e mensagem', async () => {
    const store = new ProvisionalObservationStore();
    const observation = await store.save({ at: 't', author: 'A', authorGroup: 'medicos', patientId: 'p1', text: 'x' });
    const created = await store.create({
      author: 'A',
      createdAt: 't',
      dueDate: '2026-11-24',
      observationId: observation.id,
      patientId: 'p1',
      reason: 'x',
      recipients: { group: 'medicos', people: [] },
    });
    const changed = await store.changeRecipients({
      at: 't2',
      author: 'B',
      id: created.id,
      recipients: { group: 'nutris', people: [] },
    });
    const resolved = await store.resolve({ at: 't3', author: 'C', id: created.id });
    const message = await store.send({
      at: 't',
      author: 'A',
      observationId: observation.id,
      patientId: 'p1',
      recipients: { group: 'enfermagem', people: [] },
      text: 'm',
    });

    expect(changed.changes).toEqual([{ at: 't2', author: 'B', recipients: { group: 'nutris', people: [] } }]);
    expect(resolved.resolvedBy).toBe('C');
    expect((await store.list('p1')).length).toBe(1);
    expect(await store.list('outro')).toEqual([]);
    expect(await store.listMessages('p1')).toEqual([message]);
    await expectAsync(store.resolve({ at: 't', author: 'A', id: 'nao-existe' })).toBeRejected();
  });
});
