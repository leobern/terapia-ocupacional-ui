import { HomeNotification, HomeSummary, Hospital } from '../home.models';
import { HomeActions } from './home.actions';
import { homeFeature, initialHomeState, selectNotifications } from './home.reducer';

const { reducer } = homeFeature;

function summary(overrides: Partial<HomeSummary> = {}): HomeSummary {
  return {
    patientCount: 10,
    nutritionalGoalIndicator: {
      caloricPercentage: 80,
      caloricStatus: 'NORMAL',
      proteinPercentage: 70,
      proteinStatus: 'NORMAL',
    },
    unreadNotificationCount: 3,
    ...overrides,
  };
}

function notification(id: number): HomeNotification {
  return {
    id,
    author: { id: 1, name: 'Filippa Martins', specialty: 'Nutricionista', photoUrl: null },
    description: 'Descrição ' + id,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

describe('homeFeature reducer', () => {
  it('inicia em loading-initial (evita flash de conteúdo vazio antes do skeleton)', () => {
    expect(initialHomeState.status).toBe('loading-initial');
  });

  it('loadHospitalsSuccess seleciona o primeiro hospital por padrão', () => {
    const hospitals: Hospital[] = [
      { id: 1, name: 'Hospital Vila Nova Star' },
      { id: 2, name: 'Hospital Central' },
    ];
    const state = reducer(initialHomeState, HomeActions.loadHospitalsSuccess({ hospitals }));

    expect(state.hospitals).toEqual(hospitals);
    expect(state.selectedHospitalId).toBe(1);
  });

  it('loadDataSuccess popula summary e notificações, status vira success', () => {
    const page = { items: [notification(1), notification(2)], nextCursor: 'abc' };
    const state = reducer(initialHomeState, HomeActions.loadDataSuccess({ summary: summary(), page }));

    expect(state.status).toBe('success');
    expect(state.stale).toBeFalse();
    expect(state.summary?.patientCount).toBe(10);
    expect(state.nextCursor).toBe('abc');
    expect(selectNotifications({ home: state }).length).toBe(2);
  });

  it('loadDataFailure sem dados em cache vira erro de tela cheia (FR-013)', () => {
    const state = reducer(initialHomeState, HomeActions.loadDataFailure({ message: 'falhou' }));

    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe('falhou');
  });

  it('loadDataFailure com dados em cache mantém o último sucesso e marca stale (Comportamento Offline)', () => {
    const page = { items: [notification(1)], nextCursor: null };
    const comSucesso = reducer(initialHomeState, HomeActions.loadDataSuccess({ summary: summary(), page }));

    const state = reducer(comSucesso, HomeActions.loadDataFailure({ message: 'sem conexão' }));

    expect(state.status).toBe('success');
    expect(state.stale).toBeTrue();
    expect(state.summary?.patientCount).toBe(10); // dado anterior preservado
    expect(selectNotifications({ home: state }).length).toBe(1); // lista anterior preservada
  });

  it('loadNextBatchSuccess anexa o novo lote sem substituir o anterior', () => {
    const primeiroLote = reducer(
      initialHomeState,
      HomeActions.loadDataSuccess({ summary: summary(), page: { items: [notification(1)], nextCursor: 'c1' } }),
    );

    const state = reducer(
      primeiroLote,
      HomeActions.loadNextBatchSuccess({ page: { items: [notification(2)], nextCursor: null } }),
    );

    expect(selectNotifications({ home: state }).length).toBe(2);
    expect(state.nextCursor).toBeNull();
  });

  it('loadNextBatchFailure mantém a lista atual visível (falha pontual no scroll)', () => {
    const primeiroLote = reducer(
      initialHomeState,
      HomeActions.loadDataSuccess({ summary: summary(), page: { items: [notification(1)], nextCursor: 'c1' } }),
    );

    const state = reducer(primeiroLote, HomeActions.loadNextBatchFailure({ message: 'erro' }));

    expect(state.status).toBe('success');
    expect(selectNotifications({ home: state }).length).toBe(1);
  });

  it('hospitalSelected atualiza o hospital selecionado', () => {
    const state = reducer(initialHomeState, HomeActions.hospitalSelected({ hospitalId: 2 }));

    expect(state.selectedHospitalId).toBe(2);
  });

  it('loadHospitalsSuccess sem hospitais vinculados mantém a seleção nula', () => {
    const state = reducer(initialHomeState, HomeActions.loadHospitalsSuccess({ hospitals: [] }));

    expect(state.selectedHospitalId).toBeNull();
  });

  it('loadHospitalsSuccess preserva a seleção já feita em vez de sobrescrever com o primeiro hospital', () => {
    const comSelecao = reducer(initialHomeState, HomeActions.hospitalSelected({ hospitalId: 2 }));
    const hospitals: Hospital[] = [
      { id: 1, name: 'Hospital Vila Nova Star' },
      { id: 2, name: 'Hospital Central' },
    ];

    const state = reducer(comSelecao, HomeActions.loadHospitalsSuccess({ hospitals }));

    expect(state.selectedHospitalId).toBe(2);
  });

  it('loadData mantém o status success quando já existe summary (troca de hospital sem flash de skeleton)', () => {
    const comSucesso = reducer(
      initialHomeState,
      HomeActions.loadDataSuccess({ summary: summary(), page: { items: [], nextCursor: null } }),
    );

    const state = reducer(comSucesso, HomeActions.loadData({ hospitalId: 1 }));

    expect(state.status).toBe('success');
  });

  it('loadData vira loading-initial quando ainda não há summary', () => {
    const state = reducer(initialHomeState, HomeActions.loadData({ hospitalId: 1 }));

    expect(state.status).toBe('loading-initial');
  });

  it('retryRequested limpa o erro e volta para loading-initial', () => {
    const comErro = reducer(initialHomeState, HomeActions.loadDataFailure({ message: 'falhou' }));

    const state = reducer(comErro, HomeActions.retryRequested());

    expect(state.status).toBe('loading-initial');
    expect(state.errorMessage).toBeNull();
  });

  it('loadNextBatch marca o status loading-more (spinner de fim de lista)', () => {
    const state = reducer(initialHomeState, HomeActions.loadNextBatch());

    expect(state.status).toBe('loading-more');
  });
});
