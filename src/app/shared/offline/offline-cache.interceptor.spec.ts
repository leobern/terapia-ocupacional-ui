import { HttpClient, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { LocalSessionStore } from '../../features/auth/local-session-store';
import { NetworkStateService } from './network-state.service';
import { OFFLINE_READ_TIMEOUT_MS, offlineCacheInterceptor } from './offline-cache.interceptor';
import { OfflineStore } from './offline-store';
import { InMemoryOfflineStore, tokenFor } from './offline-testing.spec';

const URL = '/api/v1/pacientes/42/evolucoes/2026-11-26';
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 5));

describe('offlineCacheInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let store: InMemoryOfflineStore;
  let network: NetworkStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([offlineCacheInterceptor])),
        provideHttpClientTesting(),
        { provide: OfflineStore, useFactory: (): InMemoryOfflineStore => new InMemoryOfflineStore() },
        { provide: OFFLINE_READ_TIMEOUT_MS, useValue: 30 },
      ],
    });
    TestBed.inject(LocalSessionStore).open({ accessToken: tokenFor({ upn: 'ana@x.com' }), refreshToken: 'r' });
    store = TestBed.inject(OfflineStore) as InMemoryOfflineStore;
    network = TestBed.inject(NetworkStateService);
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => localStorage.clear());

  const get = (url = URL): Promise<unknown> => firstValueFrom(http.get(url, { observe: 'response' }));

  it('guarda a leitura do Hub por usuário e URL e marca a rede como alcançável', async () => {
    network.markUnreachable();
    const promise = get();

    ctrl.expectOne(URL).flush({ text: 'oi' });
    await promise;
    await tick();

    expect(store.cache.get(`ana@x.com|${URL}`)?.value).toEqual({ body: { text: 'oi' }, status: 200 });
    expect(network.reachable()).toBeTrue();
  });

  it('sem resposta do servidor devolve a cópia local e marca "dado em cache"', async () => {
    const first = get();

    ctrl.expectOne(URL).flush({ text: 'oi' });
    await first;
    await tick();
    const second = get();

    ctrl.expectOne(URL).error(new ProgressEvent('error'), { status: 0 });
    const response = (await second) as HttpResponse<unknown>;

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: 'oi' });
    expect(network.staleSavedAt()).not.toBeNull();
    expect(network.reachable()).toBeFalse();
  });

  it('gateway sem servidor (504) também cai no cache; 204 volta como 204', async () => {
    const first = get();

    ctrl.expectOne(URL).flush(null, { status: 204, statusText: 'No Content' });
    await first;
    await tick();
    const second = get();

    ctrl.expectOne(URL).flush('x', { status: 504, statusText: 'Gateway Timeout' });
    const response = (await second) as HttpResponse<unknown>;

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  it('tempo esgotado cai no cache', async () => {
    const first = get();

    ctrl.expectOne(URL).flush({ n: 1 });
    await first;
    await tick();
    const second = get();

    // Sem resposta: o interceptor desiste depois de 30 ms e usa a cópia.
    ctrl.expectOne(URL);
    const response = (await second) as HttpResponse<unknown>;

    expect(response.body).toEqual({ n: 1 });
    expect(network.staleSavedAt()).not.toBeNull();
  });

  it('sem cópia local o erro de rede sobe e marca sem conexão', async () => {
    const promise = get();

    ctrl.expectOne(URL).error(new ProgressEvent('error'), { status: 0 });

    await expectAsync(promise).toBeRejected();
    expect(network.reachable()).toBeFalse();
  });

  it('cópia local ilegível conta como ausente', async () => {
    store.failReads = true;
    const promise = get();

    ctrl.expectOne(URL).error(new ProgressEvent('error'), { status: 0 });

    await expectAsync(promise).toBeRejected();
  });

  it('erro do servidor (404/403) nunca é servido do cache', async () => {
    const first = get();

    ctrl.expectOne(URL).flush({ text: 'oi' });
    await first;
    await tick();
    const second = get();

    ctrl.expectOne(URL).flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });

    await expectAsync(second).toBeRejected();
    expect(network.reachable()).toBeTrue();
  });

  it('falha ao guardar a cópia não derruba a leitura', async () => {
    store.failWrites = true;
    const promise = get();

    ctrl.expectOne(URL).flush({ text: 'oi' });

    expect(((await promise) as HttpResponse<unknown>).body).toEqual({ text: 'oi' });
  });

  it('não interfere em escritas, em URLs fora do Hub, em ids de exemplo nem sem sessão', async () => {
    const post = firstValueFrom(http.post(URL, {}));

    ctrl.expectOne(URL).flush({});
    await post;
    const others = ['/api/v1/pacientes', '/api/v1/pacientes/p1/evolucoes', '/api/v1/outro/42'].map(url => get(url));

    others.forEach((_, i) =>
      ctrl.expectOne(['/api/v1/pacientes', '/api/v1/pacientes/p1/evolucoes', '/api/v1/outro/42'][i]).flush({}),
    );
    await Promise.all(others);
    await tick();

    expect(store.cache.size).toBe(0);
  });

  it('sem sessão passa direto', async () => {
    TestBed.inject(LocalSessionStore).clear();
    const promise = get();

    ctrl.expectOne(URL).flush({});
    await promise;
    await tick();

    expect(store.cache.size).toBe(0);
  });

  it('o tempo padrão de leitura é de 10 s', () => {
    TestBed.resetTestingModule();

    expect(TestBed.inject(OFFLINE_READ_TIMEOUT_MS)).toBe(10_000);
  });

  it('qualquer resposta da API (mesmo fora do Hub) marca a rede como alcançável; falha de rede marca sem conexão', async () => {
    network.markUnreachable();
    const ok = get('/api/v1/outro/42');

    ctrl.expectOne('/api/v1/outro/42').flush({});
    await ok;
    expect(network.reachable()).toBeTrue();

    const down = get('/api/v1/outro/42');

    ctrl.expectOne('/api/v1/outro/42').error(new ProgressEvent('error'), { status: 0 });
    await expectAsync(down).toBeRejected();
    expect(network.reachable()).toBeFalse();

    const refused = get('/api/v1/outro/42');

    ctrl.expectOne('/api/v1/outro/42').flush({}, { status: 403, statusText: 'Forbidden' });
    await expectAsync(refused).toBeRejected();
    expect(network.reachable()).toBeTrue();
  });

  it('só uma leitura fresca do Hub apaga o aviso de cópia local', async () => {
    network.markStale('2026-11-26T09:00:00Z');
    const other = get('/api/v1/outro/42');

    ctrl.expectOne('/api/v1/outro/42').flush({});
    await other;
    expect(network.staleSavedAt()).not.toBeNull();

    const hub = get();

    ctrl.expectOne(URL).flush({});
    await hub;
    expect(network.staleSavedAt()).toBeNull();
  });

  it('chamadas fora da API (outros hosts) passam sem tocar no estado da rede', async () => {
    network.markUnreachable();
    const promise = firstValueFrom(http.get('https://exemplo.test/arquivo'));

    ctrl.expectOne('https://exemplo.test/arquivo').flush({});
    await promise;

    expect(network.reachable()).toBeFalse();
  });
});
