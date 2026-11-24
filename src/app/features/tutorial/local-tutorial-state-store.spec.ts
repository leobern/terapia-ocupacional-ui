import { LocalTutorialStateStore, TUTORIAL_STORAGE_KEY } from './local-tutorial-state-store';

describe('LocalTutorialStateStore (provisional)', () => {
  let store: LocalTutorialStateStore;

  beforeEach(() => {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    store = new LocalTutorialStateStore();
  });

  afterEach(() => localStorage.removeItem(TUTORIAL_STORAGE_KEY));

  it('starts pending', async () => {
    expect(await store.read()).toBe('PENDENTE');
  });

  it('persists the registered result', async () => {
    await store.register('PULADO');

    expect(await store.read()).toBe('PULADO');
  });

  it('keeps the first result (idempotent)', async () => {
    await store.register('CONCLUIDO');
    await store.register('PULADO');

    expect(await store.read()).toBe('CONCLUIDO');
  });

  it('treats an unknown stored value as pending', async () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'xyz');

    expect(await store.read()).toBe('PENDENTE');
  });

  it('stays pending and does not throw when storage is unavailable', async () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');

    expect(await store.read()).toBe('PENDENTE');
    await expectAsync(store.register('PULADO')).toBeResolved();
  });
});
